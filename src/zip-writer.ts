import { readdir, readFile, stat, writeFile } from 'node:fs/promises';
import { join, relative, sep } from 'node:path';

interface ZipEntry {
  name: string;
  data: Buffer;
  crc32: number;
  offset: number;
}

const CRC_TABLE = createCrc32Table();

export async function zipDirectory(sourceDir: string, zipPath: string): Promise<void> {
  const files = await collectFiles(sourceDir);
  const entries: ZipEntry[] = [];
  const chunks: Buffer[] = [];
  let offset = 0;

  for (const filePath of files) {
    const name = relative(sourceDir, filePath).split(sep).join('/');
    const data = await readFile(filePath);
    const crc32 = calculateCrc32(data);
    const localHeader = createLocalFileHeader(name, data, crc32);
    entries.push({ name, data, crc32, offset });
    chunks.push(localHeader, data);
    offset += localHeader.length + data.length;
  }

  const centralDirectoryOffset = offset;
  for (const entry of entries) {
    const centralHeader = createCentralDirectoryHeader(entry.name, entry.data, entry.crc32, entry.offset);
    chunks.push(centralHeader);
    offset += centralHeader.length;
  }

  const centralDirectorySize = offset - centralDirectoryOffset;
  chunks.push(createEndOfCentralDirectory(entries.length, centralDirectorySize, centralDirectoryOffset));
  await writeFile(zipPath, Buffer.concat(chunks));
}

async function collectFiles(dir: string): Promise<string[]> {
  const result: string[] = [];
  const items = await readdir(dir);
  for (const item of items.sort()) {
    const path = join(dir, item);
    const info = await stat(path);
    if (info.isDirectory()) {
      result.push(...await collectFiles(path));
    } else if (info.isFile()) {
      result.push(path);
    }
  }
  return result;
}

function createLocalFileHeader(name: string, data: Buffer, crc32: number): Buffer {
  const nameBuffer = Buffer.from(name, 'utf8');
  const buffer = Buffer.alloc(30 + nameBuffer.length);
  buffer.writeUInt32LE(0x04034b50, 0);
  buffer.writeUInt16LE(20, 4);
  buffer.writeUInt16LE(0x0800, 6);
  buffer.writeUInt16LE(0, 8);
  buffer.writeUInt16LE(0, 10);
  buffer.writeUInt16LE(0, 12);
  buffer.writeUInt32LE(crc32, 14);
  buffer.writeUInt32LE(data.length, 18);
  buffer.writeUInt32LE(data.length, 22);
  buffer.writeUInt16LE(nameBuffer.length, 26);
  buffer.writeUInt16LE(0, 28);
  nameBuffer.copy(buffer, 30);
  return buffer;
}

function createCentralDirectoryHeader(name: string, data: Buffer, crc32: number, localHeaderOffset: number): Buffer {
  const nameBuffer = Buffer.from(name, 'utf8');
  const buffer = Buffer.alloc(46 + nameBuffer.length);
  buffer.writeUInt32LE(0x02014b50, 0);
  buffer.writeUInt16LE(20, 4);
  buffer.writeUInt16LE(20, 6);
  buffer.writeUInt16LE(0x0800, 8);
  buffer.writeUInt16LE(0, 10);
  buffer.writeUInt16LE(0, 12);
  buffer.writeUInt16LE(0, 14);
  buffer.writeUInt32LE(crc32, 16);
  buffer.writeUInt32LE(data.length, 20);
  buffer.writeUInt32LE(data.length, 24);
  buffer.writeUInt16LE(nameBuffer.length, 28);
  buffer.writeUInt16LE(0, 30);
  buffer.writeUInt16LE(0, 32);
  buffer.writeUInt16LE(0, 34);
  buffer.writeUInt16LE(0, 36);
  buffer.writeUInt32LE(0, 38);
  buffer.writeUInt32LE(localHeaderOffset, 42);
  nameBuffer.copy(buffer, 46);
  return buffer;
}

function createEndOfCentralDirectory(entryCount: number, centralDirectorySize: number, centralDirectoryOffset: number): Buffer {
  const buffer = Buffer.alloc(22);
  buffer.writeUInt32LE(0x06054b50, 0);
  buffer.writeUInt16LE(0, 4);
  buffer.writeUInt16LE(0, 6);
  buffer.writeUInt16LE(entryCount, 8);
  buffer.writeUInt16LE(entryCount, 10);
  buffer.writeUInt32LE(centralDirectorySize, 12);
  buffer.writeUInt32LE(centralDirectoryOffset, 16);
  buffer.writeUInt16LE(0, 20);
  return buffer;
}

function calculateCrc32(data: Buffer): number {
  let crc = 0xffffffff;
  for (const byte of data) {
    crc = (crc >>> 8) ^ CRC_TABLE[(crc ^ byte) & 0xff];
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function createCrc32Table(): Uint32Array {
  const table = new Uint32Array(256);
  for (let index = 0; index < 256; index += 1) {
    let value = index;
    for (let bit = 0; bit < 8; bit += 1) {
      value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    }
    table[index] = value >>> 0;
  }
  return table;
}
