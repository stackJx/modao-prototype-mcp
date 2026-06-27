import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { writeExportArtifacts } from '../dist/output-writer.js';

test('writeExportArtifacts writes manifest, catalog, and result JSON', async () => {
  const outputDir = await mkdtemp(join(tmpdir(), 'modao-output-'));
  const result = await writeExportArtifacts({
    sourceUrl: 'https://modao.cc/proto/demo/sharing?screen=aaa',
    outputDir,
    exportedAt: '2026-06-20T00:00:00.000Z',
    pages: [
      {
        id: 'aaa',
        title: '登录首页',
        url: 'https://modao.cc/proto/demo/sharing?screen=aaa',
        image: 'images/001-login.png'
      }
    ]
  });

  assert.equal(result.pageCount, 1);
  assert.equal(result.pages[0].image, 'images/001-login.png');

  const manifest = JSON.parse(await readFile(join(outputDir, 'manifest.json'), 'utf8'));
  const resultJson = JSON.parse(await readFile(join(outputDir, 'result.json'), 'utf8'));
  const catalog = await readFile(join(outputDir, 'catalog.md'), 'utf8');

  assert.equal(manifest.pageCount, 1);
  assert.equal(resultJson.outputDir, outputDir);
  assert.match(catalog, /登录首页/);
  assert.match(catalog, /images\/001-login\.png/);
});
