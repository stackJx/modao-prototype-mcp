import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { exportModaoPrototype } from '../dist/exporter.js';

test('exportModaoPrototype discovers screens, captures screenshots, and writes artifacts', async () => {
  const outputDir = await mkdtemp(join(tmpdir(), 'modao-exporter-'));
  const visitedUrls = [];
  const screenshotPaths = [];
  let currentUrl = '';

  const fakePage = {
    async goto(url) {
      currentUrl = url;
      visitedUrls.push(url);
    },
    async waitForLoadState() {},
    async waitForTimeout() {},
    async evaluate(fn) {
      if (fn.name === 'extractRawScreenCandidatesFromDocument') {
        return [
          { title: '登录首页', screenId: 'screenA' },
          { title: '设置页', screenId: 'screenB' }
        ];
      }
      return [];
    },
    async screenshot(options) {
      screenshotPaths.push(options.path);
      await import('node:fs/promises').then(({ writeFile }) => writeFile(options.path, `PNG:${currentUrl}`));
    },
    locator() {
      return {
        first() {
          return {
            async count() {
              return readinessWaits > 0 && selector === '#simulator' ? 1 : 0;
            },
            async boundingBox() {
              return { x: 291, y: 359, width: 857, height: 482 };
            },
            async screenshot(options) {
              locatorScreenshots.push({ selector, path: options.path });
              await import('node:fs/promises').then(({ writeFile }) => writeFile(options.path, 'PNG:directory-device'));
            }
          };
        }
      };
    }
  };

  let closed = false;
  const automation = {
    async launch() {
      return {
        async newPage() {
          return fakePage;
        },
        async close() {
          closed = true;
        }
      };
    }
  };

  const result = await exportModaoPrototype({
    url: 'https://modao.cc/proto/demo/sharing?view_mode=read_only&screen=start',
    outputDir,
    automation,
    now: () => '2026-06-20T00:00:00.000Z'
  });

  assert.equal(result.pageCount, 2);
  assert.deepEqual(result.pages.map((page) => page.id), ['screenA', 'screenB']);
  assert.ok(visitedUrls.some((url) => new URL(url).searchParams.get('screen') === 'screenA'));
  assert.ok(visitedUrls.some((url) => new URL(url).searchParams.get('screen') === 'screenB'));
  assert.equal(screenshotPaths.length, 2);
  assert.ok(existsSync(join(outputDir, 'images', '001-登录首页-screenA.png')));
  assert.ok(existsSync(join(outputDir, 'manifest.json')));
  assert.ok(existsSync(join(outputDir, 'catalog.md')));
  assert.ok(closed);

  const catalog = await readFile(join(outputDir, 'catalog.md'), 'utf8');
  assert.match(catalog, /登录首页/);
  assert.match(catalog, /设置页/);
});

test('exportModaoPrototype falls back to full-page screenshot when a matched locator is hidden', async () => {
  const outputDir = await mkdtemp(join(tmpdir(), 'modao-exporter-hidden-'));
  let fullPageScreenshotUsed = false;

  const fakePage = {
    async goto() {},
    async waitForLoadState() {},
    async waitForTimeout() {},
    async evaluate(fn) {
      if (fn.name === 'extractRawScreenCandidatesFromDocument') {
        return [{ title: '当前页', screenId: 'screenA' }];
      }
      return [];
    },
    async screenshot(options) {
      fullPageScreenshotUsed = options.fullPage === true;
      await import('node:fs/promises').then(({ writeFile }) => writeFile(options.path, 'PNG:full-page'));
    },
    locator() {
      return {
        first() {
          return {
            async count() {
              return 1;
            },
            async screenshot() {
              throw new Error('element is not visible');
            }
          };
        }
      };
    }
  };

  const automation = {
    async launch() {
      return {
        async newPage() {
          return fakePage;
        },
        async close() {}
      };
    }
  };

  const result = await exportModaoPrototype({
    url: 'https://modao.cc/proto/demo/sharing?view_mode=read_only&screen=start',
    outputDir,
    automation,
    now: () => '2026-06-20T00:00:00.000Z'
  });

  assert.equal(result.pageCount, 1);
  assert.equal(fullPageScreenshotUsed, true);
  assert.ok(existsSync(join(outputDir, 'images', '001-当前页-screenA.png')));
});

test('exportModaoPrototype exports visible Modao artboards as individual images', async () => {
  const outputDir = await mkdtemp(join(tmpdir(), 'modao-exporter-artboards-'));
  const clips = [];

  const fakePage = {
    async goto() {},
    async waitForLoadState() {},
    async waitForTimeout() {},
    async evaluate(fn) {
      if (fn.name === 'extractRawScreenCandidatesFromDocument') {
        return [];
      }
      if (fn.name === 'extractVisibleArtboardsFromDocument') {
        return [
          { id: 'artboard-1', title: '页面 1', rect: { x: 345, y: 324, width: 242, height: 136 } },
          { id: 'artboard-2', title: '页面 1 Copy 1', rect: { x: 345, y: 479, width: 242, height: 136 } }
        ];
      }
      return [];
    },
    async screenshot(options) {
      clips.push(options.clip);
      await import('node:fs/promises').then(({ writeFile }) => writeFile(options.path, `PNG:${JSON.stringify(options.clip)}`));
    },
    locator() {
      return {
        first() {
          return {
            async count() {
              return readinessWaits > 0 && selector === '#simulator' ? 1 : 0;
            },
            async boundingBox() {
              return { x: 291, y: 359, width: 857, height: 482 };
            },
            async screenshot(options) {
              locatorScreenshots.push({ selector, path: options.path });
              await import('node:fs/promises').then(({ writeFile }) => writeFile(options.path, 'PNG:directory-device'));
            }
          };
        }
      };
    }
  };

  const automation = {
    async launch() {
      return {
        async newPage() {
          return fakePage;
        },
        async close() {}
      };
    }
  };

  const result = await exportModaoPrototype({
    url: 'https://modao.cc/proto/demo/sharing?view_mode=read_only&screen=start',
    outputDir,
    automation,
    now: () => '2026-06-20T00:00:00.000Z'
  });

  assert.equal(result.pageCount, 2);
  assert.deepEqual(result.pages.map((page) => page.title), ['页面 1', '页面 1 Copy 1']);
  assert.deepEqual(clips, [
    { x: 345, y: 324, width: 242, height: 136 },
    { x: 345, y: 479, width: 242, height: 136 }
  ]);
  assert.ok(existsSync(join(outputDir, 'images', '001-页面-1-artboard-1.png')));
  assert.ok(existsSync(join(outputDir, 'images', '002-页面-1-Copy-1-artboard-2.png')));
});

test('exportModaoPrototype makes duplicate artboard ids unique in the manifest and filenames', async () => {
  const outputDir = await mkdtemp(join(tmpdir(), 'modao-exporter-artboard-ids-'));

  const fakePage = {
    async goto() {},
    async waitForLoadState() {},
    async waitForTimeout() {},
    async evaluate(fn) {
      if (fn.name === 'extractRawScreenCandidatesFromDocument') {
        return [];
      }
      if (fn.name === 'extractVisibleArtboardsFromDocument') {
        return [
          { id: 'tree-node', title: '页面 1', rect: { x: 10, y: 20, width: 200, height: 100 } },
          { id: 'tree-node', title: '页面 2', rect: { x: 10, y: 140, width: 200, height: 100 } }
        ];
      }
      return [];
    },
    async screenshot(options) {
      await import('node:fs/promises').then(({ writeFile }) => writeFile(options.path, 'PNG'));
    }
  };

  const automation = {
    async launch() {
      return {
        async newPage() {
          return fakePage;
        },
        async close() {}
      };
    }
  };

  const result = await exportModaoPrototype({
    url: 'https://modao.cc/proto/demo/sharing?view_mode=read_only&screen=start',
    outputDir,
    automation,
    now: () => '2026-06-20T00:00:00.000Z'
  });

  assert.deepEqual(result.pages.map((page) => page.id), ['tree-node', 'tree-node-2']);
  assert.ok(existsSync(join(outputDir, 'images', '001-页面-1-tree-node.png')));
  assert.ok(existsSync(join(outputDir, 'images', '002-页面-2-tree-node-2.png')));
});

test('exportModaoPrototype opens device mode for artboards that have real canvas ids', async () => {
  const outputDir = await mkdtemp(join(tmpdir(), 'modao-exporter-device-'));
  const visitedUrls = [];
  const locatorScreenshots = [];
  let readinessWaits = 0;

  const fakePage = {
    async goto(url) {
      visitedUrls.push(url);
    },
    async waitForLoadState() {},
    async waitForTimeout() {},
    async waitForFunction() {
      readinessWaits += 1;
    },
    async evaluate(fn) {
      if (fn.name === 'extractRawScreenCandidatesFromDocument') {
        return [];
      }
      if (fn.name === 'extractVisibleArtboardsFromDocument') {
        return [
          { id: 'rcCanvasOne', title: '页面 1', rect: { x: 345, y: 324, width: 242, height: 136 } },
          { id: 'rcCanvasTwo', title: '页面 2', rect: { x: 345, y: 479, width: 242, height: 136 } }
        ];
      }
      return [];
    },
    async screenshot() {
      throw new Error('full page screenshot should not be used for known canvas ids');
    },
    locator(selector) {
      return {
        first() {
          return {
            async count() {
              return readinessWaits > 0 && selector === '#simulator' ? 1 : 0;
            },
            async boundingBox() {
              return { x: 291, y: 359, width: 857, height: 482 };
            },
            async screenshot(options) {
              locatorScreenshots.push({ selector, path: options.path });
              await import('node:fs/promises').then(({ writeFile }) => writeFile(options.path, 'PNG:device'));
            }
          };
        }
      };
    }
  };

  const automation = {
    async launch() {
      return {
        async newPage() {
          return fakePage;
        },
        async close() {}
      };
    }
  };

  const result = await exportModaoPrototype({
    url: 'https://modao.cc/proto/demo/sharing?view_mode=read_only&screen=start',
    outputDir,
    automation,
    now: () => '2026-06-20T00:00:00.000Z'
  });

  const deviceUrls = visitedUrls.filter((url) => new URL(url).searchParams.get('view_mode') === 'device');
  assert.deepEqual(deviceUrls.map((url) => new URL(url).searchParams.get('canvasId')), ['rcCanvasOne', 'rcCanvasTwo']);
  assert.deepEqual(result.pages.map((page) => page.id), ['rcCanvasOne', 'rcCanvasTwo']);
  assert.equal(readinessWaits, 2);
  assert.equal(locatorScreenshots.length, 2);
  assert.ok(existsSync(join(outputDir, 'images', '001-页面-1-rcCanvasOne.png')));
  assert.ok(existsSync(join(outputDir, 'images', '002-页面-2-rcCanvasTwo.png')));
});

test('exportModaoPrototype traverses every Modao directory in high-quality device mode by default', async () => {
  const outputDir = await mkdtemp(join(tmpdir(), 'modao-exporter-directories-'));
  const visitedUrls = [];
  const clips = [];
  const locatorScreenshots = [];
  let selectedDirectoryIndex = 0;
  let readinessWaits = 0;

  const directories = [
    { index: 0, title: '登录页' },
    { index: 1, title: '订单管理' }
  ];
  const artboardsByDirectory = [
    [
      { id: 'loginCanvas', title: '登录页 1', rect: { x: 10, y: 20, width: 200, height: 100 } },
      { id: 'loginCanvas2', title: '登录页 2', rect: { x: 10, y: 140, width: 200, height: 100 } }
    ],
    [
      { id: 'orderCanvas', title: '订单页 1', rect: { x: 10, y: 20, width: 200, height: 100 } }
    ]
  ];

  const fakePage = {
    async goto(url) {
      visitedUrls.push(url);
    },
    async waitForLoadState() {},
    async waitForTimeout() {},
    async waitForFunction() {
      readinessWaits += 1;
    },
    async evaluate(fn) {
      if (fn.name === 'extractCanvasDirectoriesFromDocument') {
        return directories;
      }
      if (fn.name === 'extractRawScreenCandidatesFromDocument') {
        return [];
      }
      if (fn.name === 'extractVisibleArtboardsFromDocument') {
        return artboardsByDirectory[selectedDirectoryIndex];
      }
      return [];
    },
    async screenshot(options) {
      clips.push(options.clip);
      await import('node:fs/promises').then(({ writeFile }) => writeFile(options.path, 'PNG:directory-overview'));
    },
    locator(selector) {
      if (selector === '#screen-scroll-list .rn-content-item') {
        return {
          nth(index) {
            return {
              async click() {
                selectedDirectoryIndex = index;
              }
            };
          },
          first() {
            return { async count() { return directories.length; } };
          }
        };
      }
      return {
        first() {
          return {
            async count() {
              return readinessWaits > 0 && selector === '#simulator' ? 1 : 0;
            },
            async boundingBox() {
              return { x: 291, y: 359, width: 857, height: 482 };
            },
            async screenshot(options) {
              locatorScreenshots.push({ selector, path: options.path });
              await import('node:fs/promises').then(({ writeFile }) => writeFile(options.path, 'PNG:directory-device'));
            }
          };
        }
      };
    }
  };

  const automation = {
    async launch() {
      return {
        async newPage() {
          return fakePage;
        },
        async close() {}
      };
    }
  };

  const result = await exportModaoPrototype({
    url: 'https://modao.cc/proto/demo/sharing?view_mode=read_only&screen=start',
    outputDir,
    automation,
    now: () => '2026-06-20T00:00:00.000Z'
  });

  assert.equal(result.pageCount, 3);
  assert.deepEqual(result.pages.map((page) => page.directory), ['登录页', '登录页', '订单管理']);
  assert.deepEqual(result.pages.map((page) => page.id), ['loginCanvas', 'loginCanvas2', 'orderCanvas']);
  const deviceUrls = visitedUrls.filter((url) => new URL(url).searchParams.get('view_mode') === 'device');
  assert.deepEqual(deviceUrls.map((url) => new URL(url).searchParams.get('canvasId')), ['loginCanvas', 'loginCanvas2', 'orderCanvas']);
  assert.equal(readinessWaits, 3);
  assert.equal(locatorScreenshots.length, 3);
  assert.deepEqual(clips, []);
  assert.ok(existsSync(join(outputDir, 'images', '001-登录页', '001-登录页-1-loginCanvas.png')));
  assert.ok(existsSync(join(outputDir, 'images', '002-订单管理', '001-订单页-1-orderCanvas.png')));
});

test('exportModaoPrototype keeps exporting when a device readiness wait times out but screenshot target exists', async () => {
  const outputDir = await mkdtemp(join(tmpdir(), 'modao-exporter-wait-timeout-'));
  let screenshotCount = 0;

  const fakePage = {
    async goto() {},
    async waitForLoadState() {},
    async waitForTimeout() {},
    async waitForFunction() {
      throw new Error('Timeout 20000ms exceeded');
    },
    async evaluate(fn) {
      if (fn.name === 'extractCanvasDirectoriesFromDocument') {
        return [{ index: 0, title: '慢页面目录' }];
      }
      if (fn.name === 'extractRawScreenCandidatesFromDocument') {
        return [];
      }
      if (fn.name === 'extractVisibleArtboardsFromDocument') {
        return [{ id: 'slowCanvas', title: '慢页面', rect: { x: 10, y: 20, width: 200, height: 100 } }];
      }
      return [];
    },
    locator(selector) {
      if (selector === '#screen-scroll-list .rn-content-item') {
        return {
          nth() {
            return { async click() {} };
          },
          first() {
            return { async count() { return 1; } };
          }
        };
      }
      return {
        first() {
          return {
            async count() {
              return selector === '#simulator' ? 1 : 0;
            },
            async boundingBox() {
              return { x: 291, y: 359, width: 857, height: 482 };
            },
            async screenshot(options) {
              screenshotCount += 1;
              await import('node:fs/promises').then(({ writeFile }) => writeFile(options.path, 'PNG:slow'));
            }
          };
        }
      };
    }
  };

  const automation = {
    async launch() {
      return {
        async newPage() {
          return fakePage;
        },
        async close() {}
      };
    }
  };

  const result = await exportModaoPrototype({
    url: 'https://modao.cc/proto/demo/sharing?view_mode=read_only&screen=start',
    outputDir,
    automation,
    now: () => '2026-06-20T00:00:00.000Z'
  });

  assert.equal(result.pageCount, 1);
  assert.equal(screenshotCount, 1);
  assert.ok(existsSync(join(outputDir, 'images', '001-慢页面目录', '001-慢页面-slowCanvas.png')));
});

test('exportModaoPrototype can export a selected directory range for high-quality batching', async () => {
  const outputDir = await mkdtemp(join(tmpdir(), 'modao-exporter-directory-range-'));
  let selectedDirectoryIndex = 0;
  const visitedUrls = [];

  const directories = [
    { index: 0, title: '登录页' },
    { index: 1, title: '订单管理' },
    { index: 2, title: '消息' }
  ];
  const artboardsByDirectory = [
    [{ id: 'loginCanvas', title: '登录页 1', rect: { x: 10, y: 20, width: 200, height: 100 } }],
    [{ id: 'orderCanvas', title: '订单页 1', rect: { x: 10, y: 20, width: 200, height: 100 } }],
    [{ id: 'messageCanvas', title: '消息页 1', rect: { x: 10, y: 20, width: 200, height: 100 } }]
  ];

  const fakePage = {
    async goto(url) { visitedUrls.push(url); },
    async waitForLoadState() {},
    async waitForTimeout() {},
    async waitForFunction() {},
    async evaluate(fn) {
      if (fn.name === 'extractCanvasDirectoriesFromDocument') return directories;
      if (fn.name === 'extractRawScreenCandidatesFromDocument') return [];
      if (fn.name === 'extractVisibleArtboardsFromDocument') return artboardsByDirectory[selectedDirectoryIndex];
      return [];
    },
    locator(selector) {
      if (selector === '#screen-scroll-list .rn-content-item') {
        return {
          nth(index) { return { async click() { selectedDirectoryIndex = index; } }; },
          first() { return { async count() { return directories.length; } }; }
        };
      }
      return {
        first() {
          return {
            async count() { return selector === '#simulator' ? 1 : 0; },
            async boundingBox() { return { x: 291, y: 359, width: 857, height: 482 }; },
            async screenshot(options) {
              await import('node:fs/promises').then(({ writeFile }) => writeFile(options.path, 'PNG:range'));
            }
          };
        }
      };
    }
  };

  const automation = {
    async launch() {
      return { async newPage() { return fakePage; }, async close() {} };
    }
  };

  const result = await exportModaoPrototype({
    url: 'https://modao.cc/proto/demo/sharing?view_mode=read_only&screen=start',
    outputDir,
    automation,
    startDirectory: 2,
    maxDirectories: 1,
    now: () => '2026-06-20T00:00:00.000Z'
  });

  assert.equal(result.pageCount, 1);
  assert.deepEqual(result.pages.map((page) => page.directory), ['订单管理']);
  assert.deepEqual(visitedUrls.filter((url) => new URL(url).searchParams.get('view_mode') === 'device').map((url) => new URL(url).searchParams.get('canvasId')), ['orderCanvas']);
  assert.ok(existsSync(join(outputDir, 'images', '002-订单管理', '001-订单页-1-orderCanvas.png')));
});
