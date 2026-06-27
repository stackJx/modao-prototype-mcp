import { join } from 'node:path';
import { z } from 'zod';
import { exportModaoPrototype } from './exporter.js';
import { zipDirectory as defaultZipDirectory } from './zip-writer.js';
import type { ExportModaoOptions, ExportResult } from './types.js';

export const downloadToolInputSchema = z.object({
  url: z.string().url().describe('墨刀 read-only 分享链接'),
  name: z.string().min(1).optional().describe('导出名称，可选；用于生成下载目录名'),
  headless: z.boolean().optional().default(true).describe('是否使用无头浏览器，默认 true'),
  timeoutMs: z.number().int().positive().optional().describe('页面加载和浏览器启动超时时间，单位毫秒'),
  startDirectory: z.number().int().positive().optional().describe('从第几个左侧目录开始导出，1 表示第一个目录'),
  maxDirectories: z.number().int().positive().optional().describe('最多导出多少个左侧目录，用于高清模式分批导出')
});

export type DownloadToolInput = z.infer<typeof downloadToolInputSchema>;
export type DownloadExporterFunction = (options: ExportModaoOptions) => Promise<ExportResult>;
export type ZipDirectoryFunction = (sourceDir: string, zipPath: string) => Promise<void>;

export interface DownloadToolHandlerOptions {
  exportRoot?: string;
  baseUrl?: string;
  now?: () => string;
  exporter?: DownloadExporterFunction;
  zipDirectory?: ZipDirectoryFunction;
}

export interface DownloadUrlSet {
  zipUrl: string;
  catalogUrl: string;
  manifestUrl: string;
  resultUrl: string;
}

const DEFAULT_EXPORT_ROOT = join(process.cwd(), 'exports', 'remote');
const DEFAULT_BASE_URL = 'http://localhost:3000';

export function createExportModaoDownloadToolHandler(options: DownloadToolHandlerOptions = {}) {
  const exportRoot = options.exportRoot ?? process.env.REMOTE_EXPORT_ROOT ?? DEFAULT_EXPORT_ROOT;
  const baseUrl = options.baseUrl ?? process.env.PUBLIC_BASE_URL ?? DEFAULT_BASE_URL;
  const now = options.now ?? (() => new Date().toISOString());
  const exporter = options.exporter ?? exportModaoPrototype;
  const zipDirectory = options.zipDirectory ?? defaultZipDirectory;

  return async (input: DownloadToolInput | Record<string, unknown>) => {
    const parsed = downloadToolInputSchema.parse(input);
    const exportId = buildExportId(parsed.name, now());
    const outputDir = join(exportRoot, exportId);
    const zipPath = join(exportRoot, `${exportId}.zip`);
    const result = await exporter({
      url: parsed.url,
      outputDir,
      headless: parsed.headless,
      timeoutMs: parsed.timeoutMs,
      startDirectory: parsed.startDirectory,
      maxDirectories: parsed.maxDirectories
    });

    await zipDirectory(outputDir, zipPath);
    const urls = createDownloadUrlSet(baseUrl, exportId);

    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify({
            exportId,
            sourceUrl: result.sourceUrl,
            outputDir,
            zipPath,
            exportedAt: result.exportedAt,
            pageCount: result.pageCount,
            ...urls,
            pages: result.pages
          }, null, 2)
        }
      ]
    };
  };
}

export function createDownloadUrlSet(baseUrl: string, exportId: string): DownloadUrlSet {
  const normalizedBase = baseUrl.replace(/\/+$/, '');
  const encodedId = encodeURIComponent(exportId);
  return {
    zipUrl: `${normalizedBase}/download/${encodedId}.zip`,
    catalogUrl: `${normalizedBase}/download/${encodedId}/catalog.md`,
    manifestUrl: `${normalizedBase}/download/${encodedId}/manifest.json`,
    resultUrl: `${normalizedBase}/download/${encodedId}/result.json`
  };
}

export function buildExportId(name: string | undefined, isoTimestamp: string): string {
  const timestamp = isoTimestamp.replace(/[-:]/g, '').replace(/\.\d{3}Z$/, '').replace('T', '-');
  const slug = slugifyName(name || 'modao-export');
  return `${slug}-${timestamp}`;
}

function slugifyName(value: string): string {
  const transliterated = Array.from(value).map((char) => PINYIN_MAP[char] ? `${PINYIN_MAP[char]}-` : char).join('');
  const slug = transliterated
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');
  return slug || 'modao-export';
}

const PINYIN_MAP: Record<string, string> = {
  招: 'zhao',
  聘: 'pin',
  系: 'xi',
  统: 'tong',
  原: 'yuan',
  型: 'xing',
  墨: 'mo',
  刀: 'dao',
  项: 'xiang',
  目: 'mu',
  首: 'shou',
  页: 'ye'
};
