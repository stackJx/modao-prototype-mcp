import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createExportModaoToolHandler } from '../dist/mcp-tool.js';

test('createExportModaoToolHandler returns an MCP text response with artifact paths', async () => {
  const handler = createExportModaoToolHandler(async (options) => {
    assert.equal(options.url, 'https://modao.cc/proto/demo/sharing?screen=aaa');
    assert.equal(options.outputDir, 'exports/demo');
    return {
      sourceUrl: options.url,
      outputDir: options.outputDir,
      exportedAt: '2026-06-20T00:00:00.000Z',
      pageCount: 1,
      pages: [
        {
          id: 'aaa',
          title: '登录首页',
          url: options.url,
          image: 'images/001-login.png'
        }
      ]
    };
  });

  const response = await handler({
    url: 'https://modao.cc/proto/demo/sharing?screen=aaa',
    outputDir: 'exports/demo'
  });

  assert.equal(response.content[0].type, 'text');
  const payload = JSON.parse(response.content[0].text);
  assert.equal(payload.pageCount, 1);
  assert.equal(payload.catalog, 'exports/demo/catalog.md');
  assert.equal(payload.manifest, 'exports/demo/manifest.json');
  assert.deepEqual(payload.images, ['exports/demo/images/001-login.png']);
});

import { createUpdateModaoImagesToolHandler, updateToolInputSchema } from '../dist/mcp-tool.js';

test('updateToolInputSchema accepts output directory, mode, force, headless, and timeout', () => {
  const parsed = updateToolInputSchema.parse({
    outputDir: 'exports/demo',
    mode: 'all',
    force: true,
    headless: false,
    timeoutMs: 12000
  });

  assert.equal(parsed.outputDir, 'exports/demo');
  assert.equal(parsed.mode, 'all');
  assert.equal(parsed.force, true);
  assert.equal(parsed.headless, false);
  assert.equal(parsed.timeoutMs, 12000);
});

test('createUpdateModaoImagesToolHandler returns an MCP text response with update report paths', async () => {
  const handler = createUpdateModaoImagesToolHandler(async (options) => {
    assert.equal(options.outputDir, 'exports/demo');
    assert.equal(options.mode, 'missing');
    assert.equal(options.force, true);
    return {
      outputDir: options.outputDir,
      manifest: 'exports/demo/manifest.json',
      updatedAt: '2026-06-20T01:00:00.000Z',
      mode: 'all',
      force: true,
      totalPages: 2,
      updatedCount: 2,
      skippedCount: 0,
      failedCount: 0,
      items: [
        {
          id: 'aaa',
          title: '登录首页',
          url: 'https://modao.cc/proto/demo/sharing?view_mode=device&canvasId=aaa',
          image: 'images/001-login.png',
          status: 'updated',
          reason: 'refreshed',
          width: 1718,
          height: 968
        }
      ]
    };
  });

  const response = await handler({
    outputDir: 'exports/demo',
    mode: 'missing',
    force: true
  });

  assert.equal(response.content[0].type, 'text');
  const payload = JSON.parse(response.content[0].text);
  assert.equal(payload.outputDir, 'exports/demo');
  assert.equal(payload.report, 'exports/demo/update-report.json');
  assert.equal(payload.updatedCount, 2);
  assert.equal(payload.failedCount, 0);
  assert.deepEqual(payload.images, ['exports/demo/images/001-login.png']);
});

import { createExportModaoDownloadToolHandler, downloadToolInputSchema } from '../dist/mcp-tool.js';

test('downloadToolInputSchema accepts url and optional friendly remote export settings without outputDir', () => {
  const parsed = downloadToolInputSchema.parse({
    url: 'https://modao.cc/proto/demo/sharing?screen=aaa',
    name: '招聘系统 原型',
    headless: false,
    timeoutMs: 12000,
    startDirectory: 2,
    maxDirectories: 3
  });

  assert.equal(parsed.url, 'https://modao.cc/proto/demo/sharing?screen=aaa');
  assert.equal(parsed.name, '招聘系统 原型');
  assert.equal(parsed.headless, false);
  assert.equal(parsed.timeoutMs, 12000);
  assert.equal(parsed.startDirectory, 2);
  assert.equal(parsed.maxDirectories, 3);
  assert.equal('outputDir' in parsed, false);
});

test('createExportModaoDownloadToolHandler exports under server root and returns download URLs', async () => {
  const calls = [];
  const handler = createExportModaoDownloadToolHandler({
    exportRoot: '/srv/modao/exports/remote',
    baseUrl: 'http://203.0.113.10:3001',
    now: () => '2026-06-22T10:20:30.000Z',
    exporter: async (options) => {
      calls.push(options);
      assert.equal(options.outputDir, '/srv/modao/exports/remote/zhao-pin-xi-tong-20260622-102030');
      return {
        sourceUrl: options.url,
        outputDir: options.outputDir,
        exportedAt: '2026-06-22T10:20:31.000Z',
        pageCount: 1,
        pages: [{ id: 'aaa', title: '首页', url: options.url, image: 'images/001-home.png' }]
      };
    },
    zipDirectory: async (sourceDir, zipPath) => {
      assert.equal(sourceDir, '/srv/modao/exports/remote/zhao-pin-xi-tong-20260622-102030');
      assert.equal(zipPath, '/srv/modao/exports/remote/zhao-pin-xi-tong-20260622-102030.zip');
    }
  });

  const response = await handler({
    url: 'https://modao.cc/proto/demo/sharing?screen=aaa',
    name: '招聘系统',
    headless: true
  });

  assert.equal(calls.length, 1);
  const payload = JSON.parse(response.content[0].text);
  assert.equal(payload.exportId, 'zhao-pin-xi-tong-20260622-102030');
  assert.equal(payload.outputDir, '/srv/modao/exports/remote/zhao-pin-xi-tong-20260622-102030');
  assert.equal(payload.zipPath, '/srv/modao/exports/remote/zhao-pin-xi-tong-20260622-102030.zip');
  assert.equal(payload.zipUrl, 'http://203.0.113.10:3001/download/zhao-pin-xi-tong-20260622-102030.zip');
  assert.equal(payload.catalogUrl, 'http://203.0.113.10:3001/download/zhao-pin-xi-tong-20260622-102030/catalog.md');
  assert.equal(payload.manifestUrl, 'http://203.0.113.10:3001/download/zhao-pin-xi-tong-20260622-102030/manifest.json');
});
