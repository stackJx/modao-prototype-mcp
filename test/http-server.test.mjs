import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isAuthorizedRequest, parseHttpServerConfig } from '../dist/http-server.js';

test('parseHttpServerConfig uses safe defaults when env is empty', () => {
  const config = parseHttpServerConfig({});

  assert.equal(config.host, '0.0.0.0');
  assert.equal(config.port, 3000);
  assert.equal(config.token, undefined);
  assert.equal(config.publicBaseUrl, 'http://localhost:3000');
  assert.match(config.downloadExportRoot, /exports\/remote$/);
});

test('parseHttpServerConfig reads HOST, PORT, and MCP_TOKEN', () => {
  const config = parseHttpServerConfig({
    HOST: '127.0.0.1',
    PORT: '3333',
    MCP_TOKEN: 'secret-token'
  });

  assert.equal(config.host, '127.0.0.1');
  assert.equal(config.port, 3333);
  assert.equal(config.token, 'secret-token');
  assert.equal(config.publicBaseUrl, 'http://127.0.0.1:3333');
  assert.match(config.downloadExportRoot, /exports\/remote$/);
});

test('parseHttpServerConfig rejects an invalid PORT', () => {
  assert.throws(
    () => parseHttpServerConfig({ PORT: 'abc' }),
    /PORT must be an integer between 1 and 65535/
  );

  assert.throws(
    () => parseHttpServerConfig({ PORT: '70000' }),
    /PORT must be an integer between 1 and 65535/
  );
});

test('isAuthorizedRequest allows all requests when no token is configured', () => {
  assert.equal(isAuthorizedRequest({}, undefined), true);
  assert.equal(isAuthorizedRequest({ authorization: 'Bearer anything' }, ''), true);
});

test('isAuthorizedRequest requires an exact bearer token when configured', () => {
  assert.equal(isAuthorizedRequest({}, 'secret-token'), false);
  assert.equal(isAuthorizedRequest({ authorization: 'Bearer wrong' }, 'secret-token'), false);
  assert.equal(isAuthorizedRequest({ authorization: 'Basic secret-token' }, 'secret-token'), false);
  assert.equal(isAuthorizedRequest({ authorization: 'Bearer secret-token' }, 'secret-token'), true);
});

test('isAuthorizedRequest accepts Node header arrays by using the first value', () => {
  assert.equal(
    isAuthorizedRequest({ authorization: ['Bearer secret-token', 'Bearer wrong'] }, 'secret-token'),
    true
  );
});

import { resolveDownloadPath } from '../dist/http-server.js';

test('resolveDownloadPath maps download URLs inside the remote export root', () => {
  assert.equal(
    resolveDownloadPath('/srv/modao/exports/remote', '/download/demo/catalog.md'),
    '/srv/modao/exports/remote/demo/catalog.md'
  );

  assert.equal(
    resolveDownloadPath('/srv/modao/exports/remote', '/download/demo.zip'),
    '/srv/modao/exports/remote/demo.zip'
  );
});

test('resolveDownloadPath rejects traversal and non-download paths', () => {
  assert.equal(resolveDownloadPath('/srv/modao/exports/remote', '/health'), null);
  assert.equal(resolveDownloadPath('/srv/modao/exports/remote', '/download/../secret.txt'), null);
  assert.equal(resolveDownloadPath('/srv/modao/exports/remote', '/download/%2e%2e/secret.txt'), null);
});
