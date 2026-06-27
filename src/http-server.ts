#!/usr/bin/env node
import { randomUUID } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { join, resolve, sep } from 'node:path';
import { createServer, type IncomingHttpHeaders, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { pathToFileURL } from 'node:url';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { isInitializeRequest } from '@modelcontextprotocol/sdk/types.js';
import { createModaoMcpServer } from './server-factory.js';

type RemoteTransport = StreamableHTTPServerTransport | SSEServerTransport;

export interface HttpServerConfig {
  host: string;
  port: number;
  token?: string;
  publicBaseUrl?: string;
  downloadExportRoot: string;
}

export function parseHttpServerConfig(env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env): HttpServerConfig {
  const host = env.HOST?.trim() || '0.0.0.0';
  const rawPort = env.PORT?.trim() || '3000';
  const port = Number(rawPort);

  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('PORT must be an integer between 1 and 65535');
  }

  const token = env.MCP_TOKEN?.trim() || undefined;
  const publicBaseUrl = env.PUBLIC_BASE_URL?.trim() || `http://${host === '0.0.0.0' ? 'localhost' : host}:${port}`;
  const downloadExportRoot = env.REMOTE_EXPORT_ROOT?.trim() || join(process.cwd(), 'exports', 'remote');

  return { host, port, token, publicBaseUrl, downloadExportRoot };
}

export function isAuthorizedRequest(headers: IncomingHttpHeaders | Record<string, string | string[] | undefined>, token?: string) {
  if (!token) {
    return true;
  }

  const authorization = headers.authorization;
  const value = Array.isArray(authorization) ? authorization[0] : authorization;
  return value === `Bearer ${token}`;
}

export function createRemoteMcpHttpServer(config: HttpServerConfig): Server {
  const transports: Record<string, RemoteTransport> = {};

  const server = createServer(async (req, res) => {
    try {
      const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);

      if (req.method === 'GET' && url.pathname === '/health') {
        sendJson(res, 200, {
          status: 'ok',
          name: 'modao-prototype-mcp',
          transports: {
            streamableHttp: '/mcp',
            sse: '/sse',
            messages: '/messages'
          }
        });
        return;
      }

      if (req.method === 'GET' && url.pathname.startsWith('/download/')) {
        await handleDownloadRequest(res, config.downloadExportRoot, url.pathname);
        return;
      }

      if (!isAuthorizedRequest(req.headers, config.token)) {
        sendJson(res, 401, {
          error: 'unauthorized',
          message: 'Missing or invalid Authorization bearer token'
        });
        return;
      }

      if (url.pathname === '/mcp') {
        await handleStreamableHttpRequest(req, res, transports, config);
        return;
      }

      if (req.method === 'GET' && url.pathname === '/sse') {
        await handleSseRequest(res, transports, config);
        return;
      }

      if (req.method === 'POST' && url.pathname === '/messages') {
        await handleSsePostRequest(req, res, url, transports);
        return;
      }

      sendJson(res, 404, {
        error: 'not_found',
        message: 'Route not found'
      });
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Error handling remote MCP request:', error);
      if (!res.headersSent) {
        sendJson(res, 500, {
          error: 'internal_server_error',
          message: 'Internal server error'
        });
      }
    }
  });

  server.on('close', () => {
    for (const sessionId of Object.keys(transports)) {
      void transports[sessionId].close().catch((error) => {
        // eslint-disable-next-line no-console
        console.error(`Error closing transport for session ${sessionId}:`, error);
      });
      delete transports[sessionId];
    }
  });

  return server;
}

export function startRemoteMcpHttpServer(config: HttpServerConfig = parseHttpServerConfig()) {
  const server = createRemoteMcpHttpServer(config);

  server.listen(config.port, config.host, () => {
    // eslint-disable-next-line no-console
    console.log(`modao-prototype-mcp remote service listening on http://${config.host}:${config.port}`);
    // eslint-disable-next-line no-console
    console.log(`Streamable HTTP endpoint: http://${config.host}:${config.port}/mcp`);
    // eslint-disable-next-line no-console
    console.log(`SSE endpoint: http://${config.host}:${config.port}/sse`);
    if (!config.token) {
      // eslint-disable-next-line no-console
      console.warn('MCP_TOKEN is not set. Remote MCP endpoints are unauthenticated.');
    }
  });

  return server;
}

async function handleStreamableHttpRequest(
  req: IncomingMessage,
  res: ServerResponse,
  transports: Record<string, RemoteTransport>,
  config: HttpServerConfig
) {
  const sessionIdHeader = req.headers['mcp-session-id'];
  const sessionId = Array.isArray(sessionIdHeader) ? sessionIdHeader[0] : sessionIdHeader;
  let body: unknown;

  if (req.method === 'POST') {
    body = await readJsonBody(req);
  }

  let transport: StreamableHTTPServerTransport;

  if (sessionId && transports[sessionId]) {
    const existingTransport = transports[sessionId];
    if (!(existingTransport instanceof StreamableHTTPServerTransport)) {
      sendJsonRpcError(res, 400, 'Bad Request: Session exists but uses a different transport protocol');
      return;
    }
    transport = existingTransport;
  } else if (!sessionId && req.method === 'POST' && isInitializeRequest(body)) {
    transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => randomUUID(),
      onsessioninitialized: (initializedSessionId) => {
        transports[initializedSessionId] = transport;
      }
    });

    transport.onclose = () => {
      const currentSessionId = transport.sessionId;
      if (currentSessionId) {
        delete transports[currentSessionId];
      }
    };

    const mcpServer = createModaoMcpServer({
      downloadBaseUrl: config.publicBaseUrl,
      downloadExportRoot: config.downloadExportRoot
    });
    await mcpServer.connect(transport);
  } else {
    sendJsonRpcError(res, 400, 'Bad Request: No valid session ID provided');
    return;
  }

  await transport.handleRequest(req, res, body);
}

async function handleSseRequest(res: ServerResponse, transports: Record<string, RemoteTransport>, config: HttpServerConfig) {
  const transport = new SSEServerTransport('/messages', res);
  transports[transport.sessionId] = transport;

  res.on('close', () => {
    delete transports[transport.sessionId];
  });

  const mcpServer = createModaoMcpServer({
    downloadBaseUrl: config.publicBaseUrl,
    downloadExportRoot: config.downloadExportRoot
  });
  await mcpServer.connect(transport);
}

async function handleSsePostRequest(
  req: IncomingMessage,
  res: ServerResponse,
  url: URL,
  transports: Record<string, RemoteTransport>
) {
  const sessionId = url.searchParams.get('sessionId') || '';
  const existingTransport = transports[sessionId];

  if (!(existingTransport instanceof SSEServerTransport)) {
    sendJson(res, 400, {
      error: 'bad_request',
      message: 'No SSE transport found for sessionId'
    });
    return;
  }

  const body = await readJsonBody(req);
  await existingTransport.handlePostMessage(req, res, body);
}


export function resolveDownloadPath(downloadExportRoot: string, pathname: string): string | null {
  if (!pathname.startsWith('/download/')) {
    return null;
  }

  let relativePath: string;
  try {
    relativePath = decodeURIComponent(pathname.slice('/download/'.length));
  } catch {
    return null;
  }

  if (!relativePath || relativePath.includes('\0')) {
    return null;
  }

  const root = resolve(downloadExportRoot);
  const target = resolve(root, relativePath);
  if (target !== root && !target.startsWith(`${root}${sep}`)) {
    return null;
  }
  return target;
}

async function handleDownloadRequest(res: ServerResponse, downloadExportRoot: string, pathname: string): Promise<void> {
  const filePath = resolveDownloadPath(downloadExportRoot, pathname);
  if (!filePath) {
    sendJson(res, 400, {
      error: 'bad_request',
      message: 'Invalid download path'
    });
    return;
  }

  const info = await stat(filePath).catch(() => null);
  if (!info?.isFile()) {
    sendJson(res, 404, {
      error: 'not_found',
      message: 'Download file not found'
    });
    return;
  }

  res.statusCode = 200;
  res.setHeader('content-type', contentTypeFor(filePath));
  res.setHeader('content-length', String(info.size));
  if (filePath.endsWith('.zip')) {
    res.setHeader('content-disposition', `attachment; filename="${filePath.split('/').pop() ?? 'modao-export.zip'}"`);
  }
  createReadStream(filePath).pipe(res);
}

function contentTypeFor(filePath: string): string {
  if (filePath.endsWith('.zip')) {
    return 'application/zip';
  }
  if (filePath.endsWith('.json')) {
    return 'application/json; charset=utf-8';
  }
  if (filePath.endsWith('.md')) {
    return 'text/markdown; charset=utf-8';
  }
  if (filePath.endsWith('.png')) {
    return 'image/png';
  }
  return 'application/octet-stream';
}

async function readJsonBody(req: IncomingMessage) {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  if (chunks.length === 0) {
    return undefined;
  }

  const text = Buffer.concat(chunks).toString('utf8').trim();
  if (!text) {
    return undefined;
  }

  return JSON.parse(text);
}

function sendJson(res: ServerResponse, statusCode: number, payload: unknown) {
  res.statusCode = statusCode;
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(payload));
}

function sendJsonRpcError(res: ServerResponse, statusCode: number, message: string) {
  sendJson(res, statusCode, {
    jsonrpc: '2.0',
    error: {
      code: -32000,
      message
    },
    id: null
  });
}

async function shutdown(server: Server) {
  await new Promise<void>((resolve) => {
    server.close(() => resolve());
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  let server: Server | undefined;

  try {
    server = startRemoteMcpHttpServer(parseHttpServerConfig());
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }

  const handleSignal = (signal: NodeJS.Signals) => {
    // eslint-disable-next-line no-console
    console.log(`Received ${signal}, shutting down remote MCP service...`);
    if (!server) {
      process.exit(0);
    }

    void shutdown(server).finally(() => process.exit(0));
  };

  process.on('SIGINT', handleSignal);
  process.on('SIGTERM', handleSignal);
}
