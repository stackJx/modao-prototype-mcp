#!/usr/bin/env node
import { pathToFileURL } from 'node:url';
import { updateModaoExportImages } from './updater.js';
import type { UpdateModaoImagesOptions, UpdateMode } from './types.js';

export function parseUpdateCliArgs(argv: string[]): UpdateModaoImagesOptions {
  if (argv.length < 1 || argv.includes('--help') || argv.includes('-h')) {
    throw new Error(usage());
  }

  const [outputDir, ...flags] = argv;
  const options: UpdateModaoImagesOptions = {
    outputDir,
    mode: 'missing',
    headless: true
  };

  for (let index = 0; index < flags.length; index += 1) {
    const flag = flags[index];
    if (flag === '--mode') {
      const value = flags[index + 1];
      if (value !== 'missing' && value !== 'all') {
        throw new Error('--mode requires either "missing" or "all"');
      }
      options.mode = value as UpdateMode;
      index += 1;
      continue;
    }
    if (flag === '--force') {
      options.force = true;
      continue;
    }
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
    throw new Error(`Unknown option: ${flag}\n\n${usage()}`);
  }

  return options;
}

export async function runUpdateCli(argv = process.argv.slice(2)): Promise<void> {
  const options = parseUpdateCliArgs(argv);
  const result = await updateModaoExportImages(options);
  console.log(JSON.stringify(result, null, 2));
}

function usage(): string {
  return [
    'Usage: modao-prototype-mcp-update <output-dir> [--mode missing|all] [--force] [--headed] [--timeout-ms N]',
    '',
    'Examples:',
    '  modao-prototype-mcp-update exports/modao-all-directories-hq-final',
    '  modao-prototype-mcp-update exports/modao-all-directories-hq-final --mode all'
  ].join('\n');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runUpdateCli().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
