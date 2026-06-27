import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildCatalogMarkdown } from '../dist/catalog.js';

test('buildCatalogMarkdown renders a readable directory with image links', () => {
  const markdown = buildCatalogMarkdown({
    sourceUrl: 'https://modao.cc/proto/demo/sharing?screen=aaa',
    outputDir: '/tmp/out',
    exportedAt: '2026-06-20T00:00:00.000Z',
    pageCount: 2,
    pages: [
      {
        id: 'aaa',
        title: '登录首页',
        url: 'https://modao.cc/proto/demo/sharing?screen=aaa',
        image: 'images/001-login.png'
      },
      {
        id: 'bbb',
        title: '设置页',
        url: 'https://modao.cc/proto/demo/sharing?screen=bbb',
        image: 'images/002-settings.png'
      }
    ]
  });

  assert.match(markdown, /^# 墨刀原型导出目录/m);
  assert.match(markdown, /源链接：<https:\/\/modao\.cc\/proto\/demo\/sharing\?screen=aaa>/);
  assert.match(markdown, /1\. \[登录首页\]\(images\/001-login\.png\)/);
  assert.match(markdown, /2\. \[设置页\]\(images\/002-settings\.png\)/);
  assert.match(markdown, /!\[登录首页\]\(images\/001-login\.png\)/);
});

test('buildCatalogMarkdown groups pages by directory when directory metadata is present', () => {
  const markdown = buildCatalogMarkdown({
    sourceUrl: 'https://modao.cc/proto/demo/sharing?screen=aaa',
    outputDir: '/tmp/out',
    exportedAt: '2026-06-20T00:00:00.000Z',
    pageCount: 2,
    pages: [
      {
        id: 'loginCanvas',
        title: '登录页 1',
        directory: '登录页',
        url: 'https://modao.cc/proto/demo/sharing?screen=aaa#loginCanvas',
        image: 'images/001-登录页/001-登录页-1-loginCanvas.png'
      },
      {
        id: 'orderCanvas',
        title: '订单页 1',
        directory: '订单管理',
        url: 'https://modao.cc/proto/demo/sharing?screen=aaa#orderCanvas',
        image: 'images/002-订单管理/001-订单页-1-orderCanvas.png'
      }
    ]
  });

  assert.match(markdown, /### 登录页/);
  assert.match(markdown, /### 订单管理/);
  assert.match(markdown, /\[登录页 1\]\(images\/001-登录页\/001-登录页-1-loginCanvas\.png\)/);
});
