# Remote Download Mode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a remote-friendly MCP export mode that writes exports on the server and returns browser-downloadable links instead of requiring the user to provide a local filesystem path.

**Architecture:** Keep existing local/export tools intact. Add a new download export handler that generates a safe export id, writes under a server-controlled export root, packages the export directory as a zip, and returns URLs based on a configured public base URL. Extend the HTTP server with safe `/download/...` static file serving rooted at the remote export directory.

**Tech Stack:** TypeScript, Node.js HTTP server, MCP SDK, Playwright export pipeline, Node test runner.

## Global Constraints

- Do not break existing `export_modao_prototype` and `update_modao_export_images` tools.
- Remote users must not pass local `outputDir` paths for the new flow.
- Download file serving must prevent path traversal outside the remote export root.
- Build and node tests must pass with `npm test`.

---

### Task 1: Tests for new remote download tool and download route

**Files:**
- Modify: `test/mcp-tool.test.mjs`
- Modify: `test/http-server.test.mjs`

**Interfaces:**
- Produces expected contracts for `downloadToolInputSchema`, `createExportModaoDownloadToolHandler`, `createDownloadUrlSet`, and `resolveDownloadPath`.

### Task 2: Implement remote download helpers

**Files:**
- Create: `src/zip-writer.ts`
- Create: `src/remote-download.ts`
- Modify: `src/mcp-tool.ts`
- Modify: `src/server-factory.ts`
- Modify: `src/http-server.ts`
- Modify: `src/types.ts`

**Interfaces:**
- `createExportModaoDownloadToolHandler(options)` returns an MCP text response with `exportId`, server paths, and download URLs.
- `resolveDownloadPath(root, requestPath)` returns safe file paths or `null`.

### Task 3: Documentation and verification

**Files:**
- Modify: `README.md`
- Modify: `使用说明.md`

**Verification:**
- Run `npm test` and inspect output.
