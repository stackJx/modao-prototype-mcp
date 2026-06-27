import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeDiscoveredScreens } from '../dist/screen-discovery.js';

const sourceUrl = 'https://modao.cc/proto/demoProject123/sharing?view_mode=read_only&screen=screen-current';

test('normalizeDiscoveredScreens deduplicates screens and preserves source URL query parameters', () => {
  const screens = normalizeDiscoveredScreens(sourceUrl, [
    { title: '当前页', screenId: 'screen-current' },
    { title: '重复页', href: 'https://modao.cc/proto/demoProject123/sharing?view_mode=read_only&screen=screen-current' },
    { title: '设置页', href: 'https://modao.cc/proto/demoProject123/sharing?screen=settings123' }
  ]);

  assert.deepEqual(screens.map((screen) => screen.id), ['screen-current', 'settings123']);
  assert.equal(screens[0].title, '当前页');
  assert.equal(new URL(screens[1].url).searchParams.get('view_mode'), 'read_only');
  assert.equal(new URL(screens[1].url).searchParams.get('screen'), 'settings123');
});

test('normalizeDiscoveredScreens falls back to the current screen when no candidates are available', () => {
  const screens = normalizeDiscoveredScreens(sourceUrl, []);

  assert.equal(screens.length, 1);
  assert.equal(screens[0].id, 'screen-current');
  assert.equal(screens[0].title, 'screen-current');
  assert.equal(screens[0].url, sourceUrl);
});
