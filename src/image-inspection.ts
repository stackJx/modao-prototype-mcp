import { readFile, stat } from 'node:fs/promises';

export interface ImageInspection {
  exists: boolean;
  valid: boolean;
  reason: 'valid-png' | 'missing' | 'empty' | 'invalid-png-signature' | 'invalid-png-ihdr' | 'unreadable';
  width?: number;
  height?: number;
  sizeBytes?: number;
}

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

export async function inspectPngFile(path: string): Promise<ImageInspection> {
  let sizeBytes: number;
  try {
    const info = await stat(path);
    sizeBytes = info.size;
  } catch (error: unknown) {
    if (isNodeErrorCode(error, 'ENOENT')) {
      return { exists: false, valid: false, reason: 'missing' };
    }
    return { exists: false, valid: false, reason: 'unreadable' };
  }

  if (sizeBytes === 0) {
    return { exists: true, valid: false, reason: 'empty', sizeBytes };
  }

  let file: Buffer;
  try {
    file = await readFile(path);
  } catch {
    return { exists: true, valid: false, reason: 'unreadable', sizeBytes };
  }

  if (file.length < 24 || !file.subarray(0, 8).equals(PNG_SIGNATURE)) {
    return { exists: true, valid: false, reason: 'invalid-png-signature', sizeBytes };
  }

  const chunkType = file.subarray(12, 16).toString('ascii');
  if (chunkType !== 'IHDR') {
    return { exists: true, valid: false, reason: 'invalid-png-ihdr', sizeBytes };
  }

  const width = file.readUInt32BE(16);
  const height = file.readUInt32BE(20);
  if (width < 1 || height < 1) {
    return { exists: true, valid: false, reason: 'invalid-png-ihdr', sizeBytes };
  }

  return { exists: true, valid: true, reason: 'valid-png', width, height, sizeBytes };
}

function isNodeErrorCode(error: unknown, code: string): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && (error as { code?: unknown }).code === code;
}
