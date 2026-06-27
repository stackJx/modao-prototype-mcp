import type { CanvasDirectory, DiscoveredScreen, RawScreenCandidate, VisibleArtboard } from './types.js';

export function normalizeDiscoveredScreens(sourceUrl: string, candidates: RawScreenCandidate[]): DiscoveredScreen[] {
  const source = new URL(sourceUrl);
  const currentScreen = source.searchParams.get('screen');
  const screens = new Map<string, DiscoveredScreen>();

  for (const candidate of candidates) {
    const id = extractScreenId(candidate);
    if (!id || screens.has(id)) {
      continue;
    }

    const url = new URL(source.toString());
    url.searchParams.set('screen', id);
    screens.set(id, {
      id,
      title: cleanTitle(candidate.title) || id,
      url: url.toString()
    });
  }

  if (screens.size === 0 && currentScreen) {
    screens.set(currentScreen, {
      id: currentScreen,
      title: currentScreen,
      url: source.toString()
    });
  }

  if (screens.size === 0) {
    screens.set('current', {
      id: 'current',
      title: 'current',
      url: source.toString()
    });
  }

  return [...screens.values()];
}

function extractScreenId(candidate: RawScreenCandidate): string | null {
  const direct = cleanTitle(candidate.screenId);
  if (direct) {
    return direct;
  }

  const href = cleanTitle(candidate.href);
  if (!href) {
    return null;
  }

  try {
    const url = new URL(href, 'https://modao.cc');
    const fromQuery = url.searchParams.get('screen');
    if (fromQuery) {
      return fromQuery;
    }
  } catch {
    const match = href.match(/[?&]screen=([^&#]+)/);
    if (match) {
      return decodeURIComponent(match[1]);
    }
  }

  const pathMatch = href.match(/screen[/=]([A-Za-z0-9_-]{6,})/);
  return pathMatch?.[1] ?? null;
}

function cleanTitle(value: string | null | undefined): string | null {
  const cleaned = value?.replace(/\s+/g, ' ').trim();
  return cleaned && cleaned.length > 0 ? cleaned : null;
}

export function extractRawScreenCandidatesFromDocument(): RawScreenCandidate[] {
  const candidates: RawScreenCandidate[] = [];
  const seen = new Set<string>();

  const push = (candidate: RawScreenCandidate) => {
    const key = `${candidate.screenId ?? ''}|${candidate.href ?? ''}|${candidate.title ?? ''}`;
    if (!seen.has(key)) {
      seen.add(key);
      candidates.push(candidate);
    }
  };

  const elements = Array.from(document.querySelectorAll<HTMLElement>('a, button, [data-screen-id], [data-screen], [data-id], [href*="screen="]'));

  for (const element of elements) {
    const href = element instanceof HTMLAnchorElement ? element.href : element.getAttribute('href');
    const screenId = element.dataset.screenId
      ?? element.dataset.screen
      ?? (looksLikeScreenId(element.dataset.id) ? element.dataset.id : null)
      ?? element.getAttribute('data-screen-id')
      ?? element.getAttribute('data-screen');
    const title = element.getAttribute('title')
      ?? element.getAttribute('aria-label')
      ?? element.innerText
      ?? element.textContent;

    if (href?.includes('screen=') || screenId) {
      push({ title, href, screenId });
    }
  }

  return candidates;
}

function looksLikeScreenId(value: string | undefined): value is string {
  return typeof value === 'string' && /^[A-Za-z0-9_-]{8,}$/.test(value);
}


export function extractVisibleArtboardsFromDocument(): VisibleArtboard[] {
  const artboardElements = Array.from(document.querySelectorAll<HTMLElement>('.tree-node.rResCanvas'))
    .map((element) => {
      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      return { element, rect, style };
    })
    .filter(({ rect, style }) => rect.width >= 80 && rect.height >= 80 && style.display !== 'none' && style.visibility !== 'hidden')
    .sort((a, b) => Math.round(a.rect.y) - Math.round(b.rect.y) || Math.round(a.rect.x) - Math.round(b.rect.x));

  const titles = Array.from(document.querySelectorAll<HTMLElement>('#mb-enabled-canvas-list .editable-name'))
    .map((element) => element.innerText || element.textContent || '')
    .map((title) => title.replace(/\s+/g, ' ').trim())
    .filter((title) => title.length > 0);

  const titleMetas = Array.from(document.querySelectorAll<HTMLElement>('[class*="canvas_title"], .canvas-title'))
    .map((element) => {
      const rect = element.getBoundingClientRect();
      const className = String(element.className);
      return {
        id: className.match(/canvas_title_([A-Za-z0-9_-]+)/)?.[1] ?? null,
        title: (element.innerText || element.textContent || '').replace(/\s+/g, ' ').trim(),
        rect
      };
    })
    .filter(({ title, rect }) => title.length > 0 && rect.width > 0 && rect.height > 0)
    .sort((a, b) => Math.round(a.rect.y) - Math.round(b.rect.y) || Math.round(a.rect.x) - Math.round(b.rect.x));

  return artboardElements.map(({ element, rect }, index) => {
    const titleMeta = titleMetas[index];
    const id = element.id || element.dataset.id || element.dataset.canvasId || titleMeta?.id || `artboard-${index + 1}`;
    const title = titles[index] || titleMeta?.title || element.getAttribute('aria-label') || element.getAttribute('title') || id;
    return {
      id,
      title,
      rect: {
        x: Math.max(0, Math.round(rect.x)),
        y: Math.max(0, Math.round(rect.y)),
        width: Math.max(1, Math.round(rect.width)),
        height: Math.max(1, Math.round(rect.height))
      }
    };
  });
}


export function extractCanvasDirectoriesFromDocument(): CanvasDirectory[] {
  const items = Array.from(document.querySelectorAll<HTMLElement>('#screen-scroll-list .rn-content-item'));
  const seen = new Set<string>();
  const directories: CanvasDirectory[] = [];

  items.forEach((element, index) => {
    const rect = element.getBoundingClientRect();
    const title = (element.innerText || element.textContent || '').replace(/\s+/g, ' ').trim();
    if (!title || rect.width < 20 || rect.height < 10 || seen.has(title)) {
      return;
    }
    seen.add(title);
    directories.push({ index, title });
  });

  return directories;
}
