# Remote MCP Service Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a remotely accessible HTTP MCP service mode to `modao-prototype-mcp` without breaking the existing stdio MCP server.

**Architecture:** Extract MCP tool registration into a reusable server factory. Keep stdio startup in `src/index.ts`. Add `src/http-server.ts` with `/health`, Streamable HTTP `/mcp`, legacy SSE `/sse` + `/messages`, session transport tracking, optional bearer token auth, and graceful shutdown.

**Tech Stack:** Node.js 22, TypeScript, `@modelcontextprotocol/sdk`, SDK Express helper, Node built-in test runner.

## Global Constraints

- Existing stdio command `node dist/index.js` must continue to work.
- Remote service must support `/mcp` Streamable HTTP and `/sse` + `/messages` SSE.
- `MCP_TOKEN` enables bearer token auth for MCP endpoints; absent token means unauthenticated mode.
- `GET /health` is unauthenticated.
- `HOST` defaults to `0.0.0.0`; `PORT` defaults to `3000`.
- Work proceeds in place because this is not a valid git repository.

---

## File Structure

- Create `src/server-factory.ts`: creates a fresh `McpServer` and registers existing Modao tools.
- Modify `src/index.ts`: use `createModaoMcpServer()` for stdio startup.
- Create `src/http-server.ts`: remote HTTP service, config parsing, auth helper, routes, startup, shutdown.
- Modify `package.json`: add `modao-prototype-mcp-http` bin and `start:http` script.
- Create `test/http-server.test.mjs`: tests config parsing and bearer token auth helper.
- Modify `README.md`: document remote startup and client endpoint examples.

### Task 1: Failing tests for remote config and auth

**Files:**
- Create: `test/http-server.test.mjs`

**Interfaces:**
- Produces expectations for `parseHttpServerConfig(env)` and `isAuthorizedRequest(headers, token)` exported from `dist/http-server.js`.

- [x] **Step 1: Write tests before production code.**
- [x] **Step 2: Run `node --test test/http-server.test.mjs` and verify it fails because `dist/http-server.js` does not exist or exports are missing.**

### Task 2: Reusable MCP server factory

**Files:**
- Create: `src/server-factory.ts`
- Modify: `src/index.ts`

**Interfaces:**
- Produces `createModaoMcpServer(): McpServer`.
- Existing stdio entrypoint consumes the factory.

- [ ] **Step 1: Create factory that registers `export_modao_prototype` and `update_modao_export_images`.**
- [ ] **Step 2: Update `src/index.ts` to connect the factory-created server to `StdioServerTransport`.**
- [ ] **Step 3: Run `npm run build` to verify TypeScript.**

### Task 3: HTTP service implementation

**Files:**
- Create: `src/http-server.ts`

**Interfaces:**
- Produces `parseHttpServerConfig(env)`, `isAuthorizedRequest(headers, token)`, `createRemoteMcpHttpApp(config)`, and `startRemoteMcpHttpServer(config)`.

- [ ] **Step 1: Implement config parsing and auth helper to pass tests.**
- [ ] **Step 2: Run `npm test` and verify all tests pass.**
- [ ] **Step 3: Implement `/health`, `/mcp`, `/sse`, `/messages`, transport map, and shutdown handling.**
- [ ] **Step 4: Run `npm test` again.**

### Task 4: Package scripts and documentation

**Files:**
- Modify: `package.json`
- Modify: `README.md`

**Interfaces:**
- Adds `modao-prototype-mcp-http` bin and `npm run start:http`.
- Documents environment variables and remote MCP endpoints.

- [ ] **Step 1: Add bin and scripts.**
- [ ] **Step 2: Add README remote service section.**
- [ ] **Step 3: Run `npm test`.**

### Task 5: Runtime verification

**Files:**
- Runtime only.

**Interfaces:**
- Confirms the remote server starts and `/health` works.

- [ ] **Step 1: Start `PORT=3333 MCP_TOKEN=test-token npm run start:http`.**
- [ ] **Step 2: Request `http://127.0.0.1:3333/health` and expect JSON with `status: "ok"`.**
- [ ] **Step 3: Stop the server.**

## Self-Review

- Spec coverage: tasks cover stdio preservation, new HTTP entrypoint, `/health`, `/mcp`, `/sse`, `/messages`, bearer token auth, env config, scripts, docs, and runtime verification.
- Placeholder scan: no TBD/TODO/fill-later placeholders remain.
- Type consistency: exported helper names are consistent across tests, implementation, and plan.
