import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseCliArgs } from '../dist/cli.js';

test('parseCliArgs reads url, output directory, headed flag, and timeout', () => {
  const args = parseCliArgs([
    'https://modao.cc/proto/demo/sharing?screen=aaa',
    'exports/demo',
    '--headed',
    '--timeout-ms',
    '120000'
  ]);

  assert.equal(args.url, 'https://modao.cc/proto/demo/sharing?screen=aaa');
  assert.equal(args.outputDir, 'exports/demo');
  assert.equal(args.headless, false);
  assert.equal(args.timeoutMs, 120000);
});

test('parseCliArgs rejects missing required arguments with usage text', () => {
  assert.throws(() => parseCliArgs([]), /Usage: modao-prototype-mcp-export/);
});

test('parseCliArgs reads directory batching options', () => {
  const args = parseCliArgs([
    'https://modao.cc/proto/demo/sharing?screen=aaa',
    'exports/demo',
    '--start-directory',
    '7',
    '--max-directories',
    '3'
  ]);

  assert.equal(args.startDirectory, 7);
  assert.equal(args.maxDirectories, 3);
});
