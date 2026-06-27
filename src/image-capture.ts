import { access } from 'node:fs/promises';
import { constants } from 'node:fs';

export interface PageLike {
  goto(url: string, options?: Record<string, unknown>): Promise<unknown>;
  waitForLoadState(state?: string, options?: Record<string, unknown>): Promise<unknown>;
  waitForTimeout(milliseconds: number): Promise<unknown>;
  waitForFunction?(fn: () => boolean, arg?: unknown, options?: Record<string, unknown>): Promise<unknown>;
  evaluate<T>(fn: () => T | Promise<T>): Promise<T>;
  screenshot(options: { path: string; fullPage?: boolean; clip?: { x: number; y: number; width: number; height: number } }): Promise<unknown>;
  locator?(selector: string): {
    first(): {
      count(): Promise<number>;
      screenshot?(options: { path: string }): Promise<unknown>;
      boundingBox?(): Promise<{ x: number; y: number; width: number; height: number } | null>;
    };
    nth?(index: number): {
      click(options?: Record<string, unknown>): Promise<unknown>;
    };
  };
}

export interface BrowserLike {
  newPage(): Promise<PageLike>;
  close(): Promise<unknown>;
}

export interface BrowserAutomation {
  launch(options: { headless: boolean; timeoutMs: number }): Promise<BrowserLike>;
}

export const DEFAULT_TIMEOUT_MS = 45_000;
export const POST_LOAD_SETTLE_MS = 1_500;

export async function loadPrototypePage(page: PageLike, url: string, timeoutMs: number): Promise<void> {
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: timeoutMs });
  await page.waitForLoadState('networkidle', { timeout: Math.min(timeoutMs, 15_000) }).catch(() => undefined);
  await page.waitForTimeout(POST_LOAD_SETTLE_MS);
}

export async function capturePrototypePageImage(
  page: PageLike,
  url: string,
  outputPath: string,
  timeoutMs: number,
  title = url
): Promise<void> {
  await loadPrototypePage(page, url, timeoutMs);
  await waitForDeviceCanvas(page, timeoutMs).catch(() => undefined);
  await capturePrototypeViewport(page, title, url, outputPath);
}

export async function waitForDeviceCanvas(page: PageLike, timeoutMs: number): Promise<void> {
  if (!page.waitForFunction) {
    return;
  }

  await page.waitForFunction(
    () => {
      const target = document.querySelector<HTMLElement>('#simulator, .pcanvas.active, #app, .screen-content, .tree-node.rResCanvas');
      if (!target) {
        return false;
      }
      const rect = target.getBoundingClientRect();
      const bodyText = document.body?.innerText ?? '';
      const targetText = target.innerText || target.textContent || '';
      return rect.width >= 200
        && rect.height >= 100
        && !bodyText.includes('0 / 0')
        && targetText.trim().length > 20;
    },
    undefined,
    { timeout: Math.min(timeoutMs, 20_000), polling: 250 }
  );
}

export async function capturePrototypeViewport(page: PageLike, title: string, url: string, path: string): Promise<void> {
  const selectors = [
    '#simulator',
    '#app',
    '.pcanvas.active',
    '.screen-content',
    '.zoom-area',
    '.tree-node.rResCanvas'
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
    throw new Error(`Failed to capture device-mode screenshot for "${title}" (${url}): ${String(error)}`);
  }
}

export function createPlaywrightAutomation(): BrowserAutomation {
  return {
    async launch({ headless, timeoutMs }) {
      const { chromium } = await import('playwright');
      const executablePath = await resolveChromeExecutable();
      const browser = await chromium.launch({
        headless,
        timeout: timeoutMs,
        executablePath,
        args: ['--no-sandbox', '--disable-dev-shm-usage']
      });

      return {
        async newPage() {
          return browser.newPage({ viewport: { width: 1440, height: 1200 }, deviceScaleFactor: 2 });
        },
        async close() {
          await browser.close();
        }
      };
    }
  };
}

async function resolveChromeExecutable(): Promise<string | undefined> {
  const candidates = [
    process.env.CHROME_PATH,
    process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/opt/google/chrome/google-chrome'
  ].filter((value): value is string => Boolean(value));

  for (const candidate of candidates) {
    if (await isExecutable(candidate)) {
      return candidate;
    }
  }

  return undefined;
}

async function isExecutable(path: string): Promise<boolean> {
  try {
    await access(path, constants.X_OK);
    return true;
  } catch {
    return false;
  }
}
