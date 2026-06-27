import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { updateModaoExportImages } from '../dist/updater.js';

const png1x1 = fakePng(1, 1);
const png2x1 = fakePng(2, 1);

function fakePng(width, height) {
  const buffer = Buffer.alloc(33);
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(buffer, 0);
  buffer.writeUInt32BE(13, 8);
  buffer.write('IHDR', 12, 'ascii');
  buffer.writeUInt32BE(width, 16);
  buffer.writeUInt32BE(height, 20);
  return buffer;
}

async function createExportDir(pages) {
  const outputDir = await mkdtemp(join(tmpdir(), 'modao-update-'));
  await mkdir(join(outputDir, 'images'), { recursive: true });
  await writeFile(join(outputDir, 'manifest.json'), JSON.stringify({
    sourceUrl: 'https://modao.cc/proto/demo/sharing?screen=start',
    outputDir,
    exportedAt: '2026-06-20T00:00:00.000Z',
    pageCount: pages.length,
    pages
  }, null, 2));
  return outputDir;
}

function createAutomation({ bytes = png2x1, failUrls = new Set() } = {}) {
  const visitedUrls = [];
  let currentUrl = '';
  let closed = false;
  const automation = {
    visitedUrls,
    get closed() {
      return closed;
    },
    async launch() {
      return {
        async newPage() {
          return {
            async goto(url) {
              currentUrl = url;
              visitedUrls.push(url);
            },
            async waitForLoadState() {},
            async waitForTimeout() {},
            async evaluate() {
              return [];
            },
            async screenshot(options) {
              if (failUrls.has(currentUrl)) {
                throw new Error(`capture failed for ${currentUrl}`);
              }
              await writeFile(options.path, bytes);
            }
          };
        },
        async close() {
          closed = true;
        }
      };
    }
  };
  return automation;
}

test('updateModaoExportImages missing mode skips valid images and updates missing or invalid images', async () => {
  const pages = [
    { id: 'valid', title: 'Valid', url: 'https://modao.cc/proto/demo/sharing?view_mode=device&canvasId=valid', image: 'images/valid.png' },
    { id: 'missing', title: 'Missing', url: 'https://modao.cc/proto/demo/sharing?view_mode=device&canvasId=missing', image: 'images/missing.png' },
    { id: 'invalid', title: 'Invalid', url: 'https://modao.cc/proto/demo/sharing?view_mode=device&canvasId=invalid', image: 'images/invalid.png' }
  ];
  const outputDir = await createExportDir(pages);
  await writeFile(join(outputDir, 'images/valid.png'), png1x1);
  await writeFile(join(outputDir, 'images/invalid.png'), 'not a png');
  const automation = createAutomation();

  const report = await updateModaoExportImages({
    outputDir,
    mode: 'missing',
    automation,
    now: () => '2026-06-20T01:00:00.000Z'
  });

  assert.equal(report.totalPages, 3);
  assert.equal(report.updatedCount, 2);
  assert.equal(report.skippedCount, 1);
  assert.equal(report.failedCount, 0);
  assert.deepEqual(report.items.map((item) => item.status), ['skipped', 'updated', 'updated']);
  assert.deepEqual(automation.visitedUrls, [pages[1].url, pages[2].url]);
  assert.deepEqual(await readFile(join(outputDir, 'images/valid.png')), png1x1);
  assert.deepEqual(await readFile(join(outputDir, 'images/missing.png')), png2x1);
  assert.deepEqual(await readFile(join(outputDir, 'images/invalid.png')), png2x1);
  const writtenReport = JSON.parse(await readFile(join(outputDir, 'update-report.json'), 'utf8'));
  assert.equal(writtenReport.updatedCount, 2);
  assert.equal(writtenReport.items[0].reason, 'valid-existing-image');
  assert.equal(automation.closed, true);
});

test('updateModaoExportImages all mode refreshes every image even when existing images are valid', async () => {
  const pages = [
    { id: 'one', title: 'One', url: 'https://modao.cc/proto/demo/sharing?view_mode=device&canvasId=one', image: 'images/one.png' },
    { id: 'two', title: 'Two', url: 'https://modao.cc/proto/demo/sharing?view_mode=device&canvasId=two', image: 'images/two.png' }
  ];
  const outputDir = await createExportDir(pages);
  await writeFile(join(outputDir, 'images/one.png'), png1x1);
  await writeFile(join(outputDir, 'images/two.png'), png1x1);
  const automation = createAutomation();

  const report = await updateModaoExportImages({ outputDir, mode: 'all', automation });

  assert.equal(report.updatedCount, 2);
  assert.equal(report.skippedCount, 0);
  assert.deepEqual(automation.visitedUrls, pages.map((page) => page.url));
  assert.deepEqual(await readFile(join(outputDir, 'images/one.png')), png2x1);
  assert.deepEqual(await readFile(join(outputDir, 'images/two.png')), png2x1);
});

test('updateModaoExportImages force refreshes every image even when mode is missing', async () => {
  const pages = [
    { id: 'one', title: 'One', url: 'https://modao.cc/proto/demo/sharing?view_mode=device&canvasId=one', image: 'images/one.png' }
  ];
  const outputDir = await createExportDir(pages);
  await writeFile(join(outputDir, 'images/one.png'), png1x1);
  const automation = createAutomation();

  const report = await updateModaoExportImages({ outputDir, mode: 'missing', force: true, automation });

  assert.equal(report.mode, 'all');
  assert.equal(report.force, true);
  assert.equal(report.updatedCount, 1);
  assert.deepEqual(await readFile(join(outputDir, 'images/one.png')), png2x1);
});

test('updateModaoExportImages keeps the old file when capture fails', async () => {
  const failingUrl = 'https://modao.cc/proto/demo/sharing?view_mode=device&canvasId=one';
  const pages = [
    { id: 'one', title: 'One', url: failingUrl, image: 'images/one.png' }
  ];
  const outputDir = await createExportDir(pages);
  await writeFile(join(outputDir, 'images/one.png'), png1x1);
  const automation = createAutomation({ failUrls: new Set([failingUrl]) });

  const report = await updateModaoExportImages({ outputDir, mode: 'all', automation });

  assert.equal(report.updatedCount, 0);
  assert.equal(report.failedCount, 1);
  assert.equal(report.items[0].status, 'failed');
  assert.match(report.items[0].reason, /capture failed/);
  assert.deepEqual(await readFile(join(outputDir, 'images/one.png')), png1x1);
  const files = await readdir(join(outputDir, 'images'));
  assert.deepEqual(files, ['one.png']);
});

test('updateModaoExportImages rejects an export directory without a valid manifest', async () => {
  const outputDir = await mkdtemp(join(tmpdir(), 'modao-update-no-manifest-'));

  await assert.rejects(
    () => updateModaoExportImages({ outputDir, automation: createAutomation() }),
    /manifest\.json/
  );
  assert.equal(existsSync(join(outputDir, 'update-report.json')), false);
});
