import { join } from 'node:path';
import { z } from 'zod';
import { exportModaoPrototype } from './exporter.js';
export { createExportModaoDownloadToolHandler, downloadToolInputSchema } from './remote-download.js';
import { updateModaoExportImages } from './updater.js';
import type { ExportModaoOptions, ExportResult, UpdateModaoImagesOptions, UpdateModaoImagesReport } from './types.js';

export const exportToolInputSchema = z.object({
  url: z.string().url().describe('墨刀 read-only 分享链接'),
  outputDir: z.string().min(1).describe('导出目录，包含 manifest.json、catalog.md、result.json 和 images/*.png'),
  headless: z.boolean().optional().default(true).describe('是否使用无头浏览器，默认 true'),
  timeoutMs: z.number().int().positive().optional().describe('页面加载和浏览器启动超时时间，单位毫秒'),
  startDirectory: z.number().int().positive().optional().describe('从第几个左侧目录开始导出，1 表示第一个目录'),
  maxDirectories: z.number().int().positive().optional().describe('最多导出多少个左侧目录，用于高清模式分批导出')
});


export const updateToolInputSchema = z.object({
  outputDir: z.string().min(1).describe('已有墨刀导出目录，必须包含 manifest.json'),
  mode: z.enum(['all', 'missing']).optional().default('missing').describe('all 全量覆盖更新；missing 只更新缺失或损坏图片'),
  force: z.boolean().optional().default(false).describe('为 true 时等同 mode=all，强制刷新所有图片'),
  headless: z.boolean().optional().default(true).describe('是否使用无头浏览器，默认 true'),
  timeoutMs: z.number().int().positive().optional().describe('页面加载和浏览器启动超时时间，单位毫秒')
});

export type ExportToolInput = z.infer<typeof exportToolInputSchema>;
export type ExporterFunction = (options: ExportModaoOptions) => Promise<ExportResult>;
export type UpdateToolInput = z.infer<typeof updateToolInputSchema>;
export type UpdaterFunction = (options: UpdateModaoImagesOptions) => Promise<UpdateModaoImagesReport>;

export function createExportModaoToolHandler(exporter: ExporterFunction = exportModaoPrototype) {
  return async (input: ExportToolInput | Record<string, unknown>) => {
    const parsed = exportToolInputSchema.parse(input);
    const result = await exporter({
      url: parsed.url,
      outputDir: parsed.outputDir,
      headless: parsed.headless,
      timeoutMs: parsed.timeoutMs,
      startDirectory: parsed.startDirectory,
      maxDirectories: parsed.maxDirectories
    });

    return createToolResponse(result);
  };
}

export function createToolResponse(result: ExportResult) {
  const payload = {
    sourceUrl: result.sourceUrl,
    outputDir: result.outputDir,
    exportedAt: result.exportedAt,
    pageCount: result.pageCount,
    manifest: join(result.outputDir, 'manifest.json'),
    catalog: join(result.outputDir, 'catalog.md'),
    result: join(result.outputDir, 'result.json'),
    images: result.pages.map((page) => join(result.outputDir, page.image)),
    pages: result.pages
  };

  return {
    content: [
      {
        type: 'text' as const,
        text: JSON.stringify(payload, null, 2)
      }
    ]
  };
}

export function createUpdateModaoImagesToolHandler(updater: UpdaterFunction = updateModaoExportImages) {
  return async (input: UpdateToolInput | Record<string, unknown>) => {
    const parsed = updateToolInputSchema.parse(input);
    const result = await updater({
      outputDir: parsed.outputDir,
      mode: parsed.mode,
      force: parsed.force,
      headless: parsed.headless,
      timeoutMs: parsed.timeoutMs
    });

    return createUpdateToolResponse(result);
  };
}

export function createUpdateToolResponse(result: UpdateModaoImagesReport) {
  const payload = {
    outputDir: result.outputDir,
    manifest: result.manifest,
    report: join(result.outputDir, 'update-report.json'),
    updatedAt: result.updatedAt,
    mode: result.mode,
    force: result.force,
    totalPages: result.totalPages,
    updatedCount: result.updatedCount,
    skippedCount: result.skippedCount,
    failedCount: result.failedCount,
    images: result.items.map((item) => join(result.outputDir, item.image)),
    items: result.items
  };

  return {
    content: [
      {
        type: 'text' as const,
        text: JSON.stringify(payload, null, 2)
      }
    ]
  };
}
