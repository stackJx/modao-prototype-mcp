import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { inspectPngFile } from '../dist/image-inspection.js';

const png1x1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAFgwJ/l3A1WQAAAABJRU5ErkJggg==',
  'base64'
);

test('inspectPngFile reads dimensions for a valid PNG', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'modao-png-valid-'));
  const file = join(dir, 'valid.png');
  await writeFile(file, png1x1);

  const result = await inspectPngFile(file);

  assert.deepEqual(result, {
    exists: true,
    valid: true,
    reason: 'valid-png',
    width: 1,
    height: 1,
    sizeBytes: png1x1.length
  });
});

test('inspectPngFile marks a missing file as invalid', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'modao-png-missing-'));

  const result = await inspectPngFile(join(dir, 'missing.png'));

  assert.equal(result.exists, false);
  assert.equal(result.valid, false);
  assert.equal(result.reason, 'missing');
});

test('inspectPngFile marks an empty file as invalid', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'modao-png-empty-'));
  const file = join(dir, 'empty.png');
  await writeFile(file, Buffer.alloc(0));

  const result = await inspectPngFile(file);

  assert.equal(result.exists, true);
  assert.equal(result.valid, false);
  assert.equal(result.reason, 'empty');
  assert.equal(result.sizeBytes, 0);
});

test('inspectPngFile marks a non-PNG file as invalid', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'modao-png-invalid-'));
  const file = join(dir, 'invalid.png');
  await writeFile(file, 'not a png');

  const result = await inspectPngFile(file);

  assert.equal(result.exists, true);
  assert.equal(result.valid, false);
  assert.equal(result.reason, 'invalid-png-signature');
});
