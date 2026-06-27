const UNSAFE_FILENAME_CHARS = /[<>:"/\\|?*\u0000-\u001f]/g;
const SEPARATORS = /[\s\u00a0]+/g;
const REPEATED_DASHES = /-+/g;
const EDGE_PUNCTUATION = /^[._ -]+|[._ -]+$/g;

export function safeFilePart(value: string, fallback = 'item'): string {
  const normalized = value
    .normalize('NFKC')
    .trim()
    .replace(UNSAFE_FILENAME_CHARS, '-')
    .replace(SEPARATORS, '-')
    .replace(REPEATED_DASHES, '-')
    .replace(EDGE_PUNCTUATION, '')
    .slice(0, 80)
    .replace(EDGE_PUNCTUATION, '');

  if (normalized.length > 0) {
    return normalized;
  }

  const safeFallback = fallback
    .normalize('NFKC')
    .trim()
    .replace(UNSAFE_FILENAME_CHARS, '-')
    .replace(SEPARATORS, '-')
    .replace(REPEATED_DASHES, '-')
    .replace(EDGE_PUNCTUATION, '')
    .slice(0, 80)
    .replace(EDGE_PUNCTUATION, '');

  return safeFallback || 'item';
}

export function buildPngFileName(index: number, title: string, id: string): string {
  const order = String(index).padStart(3, '0');
  const safeTitle = safeFilePart(title, 'page');
  const safeId = safeFilePart(id, 'screen');
  return `${order}-${safeTitle}-${safeId}.png`;
}
