import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { buildCatalogMarkdown } from './catalog.js';
import type { ExportResult, WriteExportArtifactsArgs } from './types.js';

export async function writeExportArtifacts(args: WriteExportArtifactsArgs): Promise<ExportResult> {
  const result: ExportResult = {
    sourceUrl: args.sourceUrl,
    outputDir: args.outputDir,
    exportedAt: args.exportedAt ?? new Date().toISOString(),
    pageCount: args.pages.length,
    pages: args.pages
  };

  await mkdir(args.outputDir, { recursive: true });
  await writeFile(join(args.outputDir, 'manifest.json'), `${JSON.stringify(result, null, 2)}\n`, 'utf8');
  await writeFile(join(args.outputDir, 'catalog.md'), buildCatalogMarkdown(result), 'utf8');
  await writeFile(join(args.outputDir, 'result.json'), `${JSON.stringify(result, null, 2)}\n`, 'utf8');

  return result;
}
