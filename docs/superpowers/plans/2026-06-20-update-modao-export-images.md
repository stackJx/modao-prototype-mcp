# Update Modao Export Images Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a dedicated MCP tool that updates already-exported Modao images in place, supporting full refresh and missing/damaged-only refresh.

**Architecture:** Introduce focused updater and image-inspection modules, reuse the existing Playwright screenshot approach, and add MCP/CLI surfaces without changing the existing export tool behavior.

**Tech Stack:** Node.js 22, TypeScript, Playwright, MCP SDK, node:test.

## Global Constraints

- The updater reads `outputDir/manifest.json` and only updates pages already listed there.
- `mode: "all"` and `force: true` update every listed image.
- `mode: "missing"` updates only missing, empty, or invalid PNG images.
- Replacements are in-place and safe: capture to a temp file, validate, then rename over the destination.
- Per-page failures do not stop the whole update; old images remain untouched.
- The updater writes `update-report.json`.
- Do not implement live re-scan/add/delete synchronization in this version.
- Use TDD: write a failing test, verify it fails, then implement.

---

### Task 1: PNG Inspection

**Files:**
- Create: `src/image-inspection.ts`
- Test: `test/image-inspection.test.mjs`

**Interfaces:**
- Produces: `inspectPngFile(path: string): Promise<ImageInspection>` where `ImageInspection` contains `{ exists: boolean; valid: boolean; reason: string; width?: number; height?: number; sizeBytes?: number }`.

Steps:
- [ ] Write tests for valid PNG, missing file, empty file, invalid PNG header.
- [ ] Run `npm run build && node --test test/image-inspection.test.mjs` and verify failure because module is missing.
- [ ] Implement `src/image-inspection.ts` using PNG signature and IHDR width/height reads.
- [ ] Re-run the focused test and verify pass.

### Task 2: Shared Capture Helper

**Files:**
- Create: `src/image-capture.ts`
- Modify: `src/exporter.ts`
- Test: existing `test/exporter.test.mjs`

**Interfaces:**
- Produces: `capturePrototypePageImage(page, url, outputPath, timeoutMs, title?)`.
- Consumes: existing exporter `PageLike` behavior.

Steps:
- [ ] Add a test or use existing exporter tests to prove device-mode screenshots still work.
- [ ] Extract `loadPrototypePage`, `waitForDeviceCanvas`, and `capturePrototypeViewport` behavior into the shared module.
- [ ] Update exporter to use the shared helper.
- [ ] Run `npm run build && node --test test/exporter.test.mjs` and verify pass.

### Task 3: Core Updater

**Files:**
- Create: `src/updater.ts`
- Modify: `src/types.ts`
- Test: `test/updater.test.mjs`

**Interfaces:**
- Produces: `updateModaoExportImages(options: UpdateModaoImagesOptions): Promise<UpdateModaoImagesReport>`.
- Options: `{ outputDir: string; mode?: 'all' | 'missing'; force?: boolean; headless?: boolean; timeoutMs?: number; automation?: BrowserAutomation; now?: () => string }`.

Steps:
- [ ] Write failing tests for missing mode skip/update behavior.
- [ ] Write failing tests for all/force behavior.
- [ ] Write failing tests for failure preserving old image.
- [ ] Implement manifest loading, update decisions, temp capture/rename, per-page report items, and report writing.
- [ ] Run `npm run build && node --test test/updater.test.mjs` and verify pass.

### Task 4: MCP Tool Surface

**Files:**
- Modify: `src/mcp-tool.ts`
- Modify: `src/index.ts`
- Test: `test/mcp-tool.test.mjs`

**Interfaces:**
- Produces MCP tool `update_modao_export_images` with schema fields `outputDir`, `mode`, `force`, `headless`, `timeoutMs`.

Steps:
- [ ] Write failing MCP tests asserting the update tool schema and handler response.
- [ ] Implement schema, handler factory, response formatter, and server registration.
- [ ] Run `npm run build && node --test test/mcp-tool.test.mjs` and verify pass.

### Task 5: CLI and Documentation

**Files:**
- Create: `src/update-cli.ts`
- Modify: `package.json`
- Modify: `README.md`
- Test: `test/update-cli.test.mjs`

**Interfaces:**
- Produces CLI bin/script for updating: `modao-prototype-mcp-update <output-dir> [--mode missing|all] [--force] [--headed] [--timeout-ms N]`.

Steps:
- [ ] Write failing CLI parser tests.
- [ ] Implement update CLI parser and runner.
- [ ] Add package bin/script entries.
- [ ] Update README with MCP and CLI usage examples.
- [ ] Run `npm test` and verify all tests pass.
