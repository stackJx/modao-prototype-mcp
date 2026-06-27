#!/usr/bin/env node
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createModaoMcpServer } from './server-factory.js';

const transport = new StdioServerTransport();
const server = createModaoMcpServer();
await server.connect(transport);
