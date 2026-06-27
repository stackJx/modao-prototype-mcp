import { test } from 'node:test';
import assert from 'node:assert/strict';
import { safeFilePart, buildPngFileName } from '../dist/filename.js';

test('safeFilePart replaces filesystem-unsafe characters while preserving readable Chinese text', () => {
  assert.equal(safeFilePart(' 登录/首页:按钮?  '), '登录-首页-按钮');
});

test('safeFilePart falls back when the input has no usable characters', () => {
  assert.equal(safeFilePart('////', 'screen'), 'screen');
});

test('buildPngFileName includes padded order, safe title, safe id, and png extension', () => {
  assert.equal(buildPngFileName(3, '登录/首页', 'screen-current'), '003-登录-首页-screen-current.png');
});
