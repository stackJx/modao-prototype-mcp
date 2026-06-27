import type { ExportResult, ExportedPage } from './types.js';

export function buildCatalogMarkdown(result: ExportResult): string {
  const lines: string[] = [
    '# 墨刀原型导出目录',
    '',
    `- 源链接：<${result.sourceUrl}>`,
    `- 导出时间：${result.exportedAt}`,
    `- 页面数量：${result.pageCount}`,
    '',
    '## 页面目录',
    ''
  ];

  if (result.pages.some((page) => page.directory)) {
    for (const group of groupPagesByDirectory(result.pages)) {
      lines.push(`### ${escapeMarkdownText(group.directory)}`);
      lines.push('');
      group.pages.forEach((page, index) => {
        lines.push(`${index + 1}. [${escapeMarkdownText(page.title)}](${encodeMarkdownHref(page.image)}) — \`${page.id}\``);
      });
      lines.push('');
    }
  } else {
    result.pages.forEach((page, index) => {
      lines.push(`${index + 1}. [${escapeMarkdownText(page.title)}](${encodeMarkdownHref(page.image)}) — \`${page.id}\``);
    });
    lines.push('');
  }

  lines.push('## 图片预览', '');

  if (result.pages.some((page) => page.directory)) {
    for (const group of groupPagesByDirectory(result.pages)) {
      lines.push(`### ${escapeMarkdownText(group.directory)}`);
      lines.push('');
      group.pages.forEach((page, index) => {
        pushPreview(lines, page, index + 1);
      });
    }
  } else {
    result.pages.forEach((page, index) => {
      pushPreview(lines, page, index + 1);
    });
  }

  return `${lines.join('\n').trimEnd()}\n`;
}

function pushPreview(lines: string[], page: ExportedPage, index: number): void {
  const title = escapeMarkdownText(page.title);
  const image = encodeMarkdownHref(page.image);
  lines.push(`#### ${index}. ${title}`);
  lines.push('');
  lines.push(`- 页面链接：<${page.url}>`);
  lines.push('');
  lines.push(`![${title}](${image})`);
  lines.push('');
}

function groupPagesByDirectory(pages: ExportedPage[]): Array<{ directory: string; pages: ExportedPage[] }> {
  const groups: Array<{ directory: string; pages: ExportedPage[] }> = [];
  const indexByDirectory = new Map<string, number>();

  for (const page of pages) {
    const directory = page.directory || '未分组';
    let index = indexByDirectory.get(directory);
    if (index === undefined) {
      index = groups.length;
      indexByDirectory.set(directory, index);
      groups.push({ directory, pages: [] });
    }
    groups[index].pages.push(page);
  }

  return groups;
}

function escapeMarkdownText(value: string): string {
  return value.replace(/[\\[\]`*_{}()#+.!|-]/g, '\\$&');
}

function encodeMarkdownHref(value: string): string {
  return value.replace(/\)/g, '%29').replace(/\(/g, '%28');
}
