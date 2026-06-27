import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseUpdateCliArgs } from '../dist/update-cli.js';

test('parseUpdateCliArgs reads output directory, mode, force, headed flag, and timeout', () => {
  const args = parseUpdateCliArgs([
    'exports/demo',
    '--mode',
    'all',
    '--force',
    '--headed',
    '--timeout-ms',
    '120000'
  ]);

  assert.equal(args.outputDir, 'exports/demo');
  assert.equal(args.mode, 'all');
  assert.equal(args.force, true);
  assert.equal(args.headless, false);
  assert.equal(args.timeoutMs, 120000);
});

test('parseUpdateCliArgs defaults to missing mode and headless browser', () => {
  const args = parseUpdateCliArgs(['exports/demo']);

  assert.equal(args.outputDir, 'exports/demo');
  assert.equal(args.mode, 'missing');
  assert.equal(args.headless, true);
});

test('parseUpdateCliArgs rejects invalid mode', () => {
  assert.throws(
    () => parseUpdateCliArgs(['exports/demo', '--mode', 'changed']),
    /--mode requires either "missing" or "all"/
  );
});

test('parseUpdateCliArgs rejects missing output directory with usage text', () => {
  assert.throws(() => parseUpdateCliArgs([]), /Usage: modao-prototype-mcp-update/);
});
