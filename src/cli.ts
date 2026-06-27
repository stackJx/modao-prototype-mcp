#!/usr/bin/env node
import { pathToFileURL } from 'node:url';
import { exportModaoPrototype } from './exporter.js';
import type { ExportModaoOptions } from './types.js';

export function parseCliArgs(argv: string[]): ExportModaoOptions {
  if (argv.length < 2 || argv.includes('--help') || argv.includes('-h')) {
    throw new Error(usage());
  }

  const [url, outputDir, ...flags] = argv;
  const options: ExportModaoOptions = {
    url,
    outputDir,
    headless: true
  };

  for (let index = 0; index < flags.length; index += 1) {
    const flag = flags[index];
    if (flag === '--headed') {
      options.headless = false;
      continue;
    }
    if (flag === '--headless') {
      options.headless = true;
      continue;
    }
    if (flag === '--timeout-ms') {
      const value = flags[index + 1];
      if (!value || Number.isNaN(Number(value)) || Number(value) <= 0) {
        throw new Error('--timeout-ms requires a positive number');
      }
      options.timeoutMs = Number(value);
      index += 1;
      continue;
    }
    if (flag === '--start-directory') {
      const value = flags[index + 1];
      if (!value || Number.isNaN(Number(value)) || Number(value) <= 0) {
        throw new Error('--start-directory requires a positive number');
      }
      options.startDirectory = Number(value);
      index += 1;
      continue;
    }
    if (flag === '--max-directories') {
      const value = flags[index + 1];
      if (!value || Number.isNaN(Number(value)) || Number(value) <= 0) {
        throw new Error('--max-directories requires a positive number');
      }
      options.maxDirectories = Number(value);
      index += 1;
      continue;
    }
    throw new Error(`Unknown option: ${flag}\n\n${usage()}`);
  }

  return options;
}

export async function runCli(argv = process.argv.slice(2)): Promise<void> {
  const options = parseCliArgs(argv);
  const result = await exportModaoPrototype(options);
  console.log(JSON.stringify(result, null, 2));
}

function usage(): string {
  return [
    'Usage: modao-prototype-mcp-export <modao-url> <output-dir> [--headed] [--timeout-ms N] [--start-directory N] [--max-directories N]',
    '',
    'Example:',
    '  modao-prototype-mcp-export "https://modao.cc/proto/your-project-id/sharing?view_mode=read_only&screen=your-screen-id" exports/modao-sample'
  ].join('\n');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runCli().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
