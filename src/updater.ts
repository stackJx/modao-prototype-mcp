import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { capturePrototypePageImage, createPlaywrightAutomation, DEFAULT_TIMEOUT_MS } from './image-capture.js';
import { inspectPngFile } from './image-inspection.js';
import type { BrowserAutomation } from './image-capture.js';
import type { ExportResult, ExportedPage, UpdateMode, UpdateModaoImagesOptions, UpdateModaoImagesReport, UpdateModaoImagesReportItem } from './types.js';

interface TestableUpdateModaoImagesOptions extends UpdateModaoImagesOptions {
  automation?: BrowserAutomation;
  now?: () => string;
}

export async function updateModaoExportImages(options: TestableUpdateModaoImagesOptions): Promise<UpdateModaoImagesReport> {
  const outputDir = options.outputDir;
  const manifestPath = join(outputDir, 'manifest.json');
  const manifest = await readManifest(manifestPath);
  const effectiveMode: UpdateMode = options.force ? 'all' : options.mode ?? 'missing';
  const force = options.force ?? false;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const headless = options.headless ?? true;
  const now = options.now?.() ?? new Date().toISOString();
  const items: UpdateModaoImagesReportItem[] = [];
  const pagesToUpdate: Array<{ page: ExportedPage; imagePath: string }> = [];

  for (const page of manifest.pages) {
    const imagePath = join(outputDir, page.image);
    if (effectiveMode === 'all') {
      pagesToUpdate.push({ page, imagePath });
      continue;
    }

    const inspection = await inspectPngFile(imagePath);
    if (inspection.valid) {
      items.push({
        id: page.id,
        title: page.title,
        image: page.image,
        url: page.url,
        status: 'skipped',
        reason: 'valid-existing-image',
        width: inspection.width,
        height: inspection.height
      });
    } else {
      pagesToUpdate.push({ page, imagePath });
    }
  }

  if (pagesToUpdate.length > 0) {
    const automation = options.automation ?? createPlaywrightAutomation();
    const browser = await automation.launch({ headless, timeoutMs });
    try {
      const page = await browser.newPage();
      for (const [index, target] of pagesToUpdate.entries()) {
        items.push(await updateOnePage(page, target.page, target.imagePath, timeoutMs, index));
      }
    } finally {
      await browser.close().catch(() => undefined);
    }
  }

  const orderedItems = orderItemsLikeManifest(manifest.pages, items);
  const report: UpdateModaoImagesReport = {
    outputDir,
    manifest: manifestPath,
    updatedAt: now,
    mode: effectiveMode,
    force,
    totalPages: manifest.pages.length,
    updatedCount: orderedItems.filter((item) => item.status === 'updated').length,
    skippedCount: orderedItems.filter((item) => item.status === 'skipped').length,
    failedCount: orderedItems.filter((item) => item.status === 'failed').length,
    items: orderedItems
  };

  await writeFile(join(outputDir, 'update-report.json'), `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  return report;
}

async function readManifest(manifestPath: string): Promise<ExportResult> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(await readFile(manifestPath, 'utf8'));
  } catch (error) {
    throw new Error(`Unable to read ${manifestPath}: ${String(error)}`);
  }

  if (!isExportResult(parsed)) {
    throw new Error(`Invalid Modao export manifest: ${manifestPath}`);
  }
  return parsed;
}

function isExportResult(value: unknown): value is ExportResult {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const candidate = value as { pages?: unknown };
  if (!Array.isArray(candidate.pages)) {
    return false;
  }
  return candidate.pages.every((page) => {
    if (!page || typeof page !== 'object') {
      return false;
    }
    const item = page as Partial<ExportedPage>;
    return typeof item.id === 'string'
      && typeof item.title === 'string'
      && typeof item.url === 'string'
      && typeof item.image === 'string';
  });
}

async function updateOnePage(
  browserPage: Parameters<typeof capturePrototypePageImage>[0],
  page: ExportedPage,
  imagePath: string,
  timeoutMs: number,
  index: number
): Promise<UpdateModaoImagesReportItem> {
  const tempPath = `${imagePath}.tmp-${process.pid}-${Date.now()}-${index}`;
  try {
    await mkdir(dirname(imagePath), { recursive: true });
    await capturePrototypePageImage(browserPage, page.url, tempPath, timeoutMs, page.title);
    const inspection = await inspectPngFile(tempPath);
    if (!inspection.valid) {
      throw new Error(`captured file is not a valid PNG: ${inspection.reason}`);
    }
    await rename(tempPath, imagePath);
    return {
      id: page.id,
      title: page.title,
      image: page.image,
      url: page.url,
      status: 'updated',
      reason: 'refreshed',
      width: inspection.width,
      height: inspection.height
    };
  } catch (error) {
    await rm(tempPath, { force: true }).catch(() => undefined);
    return {
      id: page.id,
      title: page.title,
      image: page.image,
      url: page.url,
      status: 'failed',
      reason: error instanceof Error ? error.message : String(error)
    };
  }
}

function orderItemsLikeManifest(pages: ExportedPage[], items: UpdateModaoImagesReportItem[]): UpdateModaoImagesReportItem[] {
  const queues = new Map<string, UpdateModaoImagesReportItem[]>();
  for (const item of items) {
    const key = itemKey(item);
    const queue = queues.get(key) ?? [];
    queue.push(item);
    queues.set(key, queue);
  }

  return pages.flatMap((page) => {
    const queue = queues.get(itemKey(page));
    const item = queue?.shift();
    return item ? [item] : [];
  });
}

function itemKey(value: Pick<ExportedPage, 'id' | 'image'>): string {
  return `${value.id}|${value.image}`;
}
