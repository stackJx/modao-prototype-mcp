import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { buildPngFileName, safeFilePart } from './filename.js';
import { normalizeDiscoveredScreens, extractRawScreenCandidatesFromDocument, extractVisibleArtboardsFromDocument, extractCanvasDirectoriesFromDocument } from './screen-discovery.js';
import { writeExportArtifacts } from './output-writer.js';
import { DEFAULT_TIMEOUT_MS, capturePrototypePageImage, createPlaywrightAutomation, loadPrototypePage } from './image-capture.js';
import type { CanvasDirectory, DiscoveredScreen, ExportModaoOptions, ExportResult, RawScreenCandidate, VisibleArtboard } from './types.js';
import type { BrowserAutomation, PageLike } from './image-capture.js';

interface TestableExportModaoOptions extends ExportModaoOptions {
  automation?: BrowserAutomation;
  now?: () => string;
}


export async function exportModaoPrototype(options: TestableExportModaoOptions): Promise<ExportResult> {
  const sourceUrl = validateModaoUrl(options.url);
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const headless = options.headless ?? true;
  const automation = options.automation ?? createPlaywrightAutomation();
  const browser = await automation.launch({ headless, timeoutMs });

  try {
    const page = await browser.newPage();
    await loadPrototypePage(page, sourceUrl, timeoutMs);

    const rawCandidates = await page.evaluate(extractRawScreenCandidatesFromDocument).catch((): RawScreenCandidate[] => []);
    const directories = await page.evaluate(extractCanvasDirectoriesFromDocument).catch((): CanvasDirectory[] => []);
    const artboards = await page.evaluate(extractVisibleArtboardsFromDocument).catch((): VisibleArtboard[] => []);
    const screens = normalizeDiscoveredScreens(sourceUrl, rawCandidates);
    const imagesDir = join(options.outputDir, 'images');
    await mkdir(imagesDir, { recursive: true });

    const pages = directories.length > 0
      ? await captureAllDirectories(page, sourceUrl, imagesDir, directories, timeoutMs, options.startDirectory, options.maxDirectories)
      : artboards.length > 0
        ? await captureArtboards(page, sourceUrl, imagesDir, artboards, timeoutMs)
        : await captureScreens(page, imagesDir, screens, timeoutMs);

    return await writeExportArtifacts({
      sourceUrl,
      outputDir: options.outputDir,
      exportedAt: options.now?.() ?? new Date().toISOString(),
      pages
    });
  } finally {
    await browser.close().catch(() => undefined);
  }
}



async function captureAllDirectories(
  page: PageLike,
  sourceUrl: string,
  imagesDir: string,
  directories: CanvasDirectory[],
  timeoutMs: number,
  startDirectory = 1,
  maxDirectories?: number
) {
  const pages = [];
  const normalizedStart = Math.max(1, Math.trunc(startDirectory || 1));
  const startIndex = normalizedStart - 1;
  const endIndex = maxDirectories ? startIndex + Math.max(1, Math.trunc(maxDirectories)) : directories.length;
  const selectedDirectories = directories.slice(startIndex, endIndex);

  for (const [selectedOffset, directory] of selectedDirectories.entries()) {
    const directoryOrder = startIndex + selectedOffset;
    await loadPrototypePage(page, sourceUrl, timeoutMs);
    await clickCanvasDirectory(page, directory, timeoutMs);
    const artboards = await page.evaluate(extractVisibleArtboardsFromDocument).catch((): VisibleArtboard[] => []);
    if (artboards.length === 0) {
      continue;
    }

    const directoryPart = `${String(directoryOrder + 1).padStart(3, '0')}-${safeFilePart(directory.title, `directory-${directoryOrder + 1}`)}`;
    const directoryImagesDir = join(imagesDir, directoryPart);
    await mkdir(directoryImagesDir, { recursive: true });
    const directoryPages = await captureArtboards(
      page,
      sourceUrl,
      directoryImagesDir,
      artboards,
      timeoutMs,
      directory.title,
      `images/${directoryPart}`,
      true
    );
    pages.push(...directoryPages);
  }
  return pages;
}

async function clickCanvasDirectory(page: PageLike, directory: CanvasDirectory, timeoutMs: number): Promise<void> {
  if (!page.locator) {
    return;
  }
  const list = page.locator('#screen-scroll-list .rn-content-item');
  if (!list.nth) {
    return;
  }
  await list.nth(directory.index).click({ timeout: Math.min(timeoutMs, 10_000) });
  await page.waitForTimeout(1_000);
}

async function captureArtboards(page: PageLike, sourceUrl: string, imagesDir: string, artboards: VisibleArtboard[], timeoutMs: number, directoryTitle?: string, relativeImageDir = 'images', useDeviceMode = true) {
  const pages = [];
  const seenIds = new Map<string, number>();
  for (const [index, artboard] of artboards.entries()) {
    const id = uniqueArtboardId(artboard.id, index, seenIds);
    const fileName = buildPngFileName(index + 1, artboard.title, id);
    const image = `${relativeImageDir}/${fileName}`;
    const imagePath = join(imagesDir, fileName);
    const canOpenDeviceMode = useDeviceMode && !isSyntheticArtboardId(id);
    const pageUrl = canOpenDeviceMode ? buildDeviceModeUrl(sourceUrl, id) : `${sourceUrl}#${encodeURIComponent(id)}`;

    if (canOpenDeviceMode) {
      await capturePrototypePageImage(page, pageUrl, imagePath, timeoutMs, artboard.title);
    } else {
      await page.screenshot({ path: imagePath, clip: artboard.rect });
    }

    pages.push({
      id,
      title: artboard.title,
      url: pageUrl,
      image,
      ...(directoryTitle ? { directory: directoryTitle } : {})
    });
  }
  return pages;
}

function uniqueArtboardId(rawId: string, index: number, seenIds: Map<string, number>): string {
  const baseId = rawId.trim() || `artboard-${index + 1}`;
  const count = seenIds.get(baseId) ?? 0;
  seenIds.set(baseId, count + 1);
  return count === 0 ? baseId : `${baseId}-${count + 1}`;
}

function isSyntheticArtboardId(id: string): boolean {
  return /^artboard-\d+$/.test(id);
}

function buildDeviceModeUrl(sourceUrl: string, canvasId: string): string {
  const url = new URL(sourceUrl);
  url.searchParams.set('view_mode', 'device');
  url.searchParams.set('canvasId', canvasId);
  return url.toString();
}


async function captureScreens(page: PageLike, imagesDir: string, screens: DiscoveredScreen[], timeoutMs: number) {
  const pages = [];
  for (const [index, screen] of screens.entries()) {
    await loadPrototypePage(page, screen.url, timeoutMs);
    const fileName = buildPngFileName(index + 1, screen.title, screen.id);
    const image = `images/${fileName}`;
    await captureScreen(page, screen, join(imagesDir, fileName));
    pages.push({
      id: screen.id,
      title: screen.title,
      url: screen.url,
      image
    });
  }
  return pages;
}

function validateModaoUrl(rawUrl: string): string {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error(`Invalid Modao URL: ${rawUrl}`);
  }

  if (!parsed.hostname.endsWith('modao.cc')) {
    throw new Error(`Expected a modao.cc URL, received: ${parsed.hostname}`);
  }

  return parsed.toString();
}


async function captureScreen(page: PageLike, screen: DiscoveredScreen, path: string): Promise<void> {
  const selectors = [
    '#screens',
    '#mb-artboard',
    '.mb-viewport',
    '.screen-container',
    '.ruler-canvas-wrapper',
    '[data-testid="prototype-canvas"]',
    '[data-testid="viewer-canvas"]',
    '.prototype-container'
  ];

  if (page.locator) {
    for (const selector of selectors) {
      const target = page.locator(selector).first();
      const count = await target.count().catch(() => 0);
      if (count > 0 && target.screenshot) {
        const box = target.boundingBox ? await target.boundingBox().catch(() => null) : null;
        if (box && (box.width < 200 || box.height < 100)) {
          continue;
        }
        try {
          await target.screenshot({ path });
          return;
        } catch {
          continue;
        }
      }
    }
  }

  try {
    await page.screenshot({ path, fullPage: true });
  } catch (error) {
    throw new Error(`Failed to capture screenshot for "${screen.title}" (${screen.url}): ${String(error)}`);
  }
}
