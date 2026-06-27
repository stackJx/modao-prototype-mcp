# Update Modao Export Images Design

## Goal

Add a dedicated MCP tool, `update_modao_export_images`, for updating images that have already been exported from a Modao prototype. The tool must support both requested update modes:

- **Full refresh**: overwrite every image listed in an existing `manifest.json`.
- **Missing/damaged refresh**: only regenerate images that are missing or invalid.

The update is in-place: successful screenshots replace the existing PNG files, while failures leave any existing image untouched.

## Scope

In scope:

- Read an existing export directory containing `manifest.json`.
- Use each manifest page's existing `url` and `image` fields.
- Refresh screenshots with Playwright using the same high-quality viewport/deviceScaleFactor behavior as the exporter.
- Write an `update-report.json` into the export directory.
- Expose the behavior through MCP as `update_modao_export_images`.
- Provide CLI access for local runs.

Out of scope for this version:

- Re-scanning Modao directories.
- Adding newly created pages from the live prototype.
- Removing pages deleted from the live prototype.
- Backing up old images before replacement.

## User-facing behavior

### MCP tool input

`update_modao_export_images` accepts:

- `outputDir` (required): existing export directory.
- `mode` (optional): either `"all"` or `"missing"`; default `"missing"`.
- `force` (optional): when `true`, behaves like `mode: "all"`.
- `headless` (optional): default `true`.
- `timeoutMs` (optional): page/browser timeout in milliseconds.

### Modes

- `mode: "all"`: update every page listed in `manifest.json`.
- `mode: "missing"`: update only pages whose image is missing, empty, or not a readable PNG.
- `force: true`: update every page regardless of `mode`.

### Replacement safety

For each image:

1. Capture to a temporary file next to the destination, for example `image.png.tmp-<pid>-<timestamp>`.
2. Validate the temp file is a PNG with readable dimensions.
3. Rename temp file over the original PNG.
4. If any step fails, delete the temp file and keep the original image unchanged.

## Report format

The updater writes `update-report.json` in `outputDir`:

```json
{
  "outputDir": "exports/modao-all-directories-hq-final",
  "manifest": "exports/modao-all-directories-hq-final/manifest.json",
  "updatedAt": "2026-06-20T00:00:00.000Z",
  "mode": "missing",
  "force": false,
  "totalPages": 65,
  "updatedCount": 0,
  "skippedCount": 65,
  "failedCount": 0,
  "items": [
    {
      "id": "rc...",
      "title": "页面 1",
      "image": "images/001-登录页/001-页面-1.png",
      "url": "https://modao.cc/...&canvasId=rc...",
      "status": "skipped",
      "reason": "valid-existing-image"
    }
  ]
}
```

Item statuses:

- `updated`: screenshot replaced the image.
- `skipped`: no update needed in `missing` mode.
- `failed`: update failed and existing image was preserved.

## Architecture

Add an updater module separate from the exporter:

- `src/image-inspection.ts`: validates PNG files and reads dimensions.
- `src/image-capture.ts`: shared Playwright screenshot helper used by exporter and updater.
- `src/updater.ts`: loads manifest, decides update/skip, captures temporary files, writes report.
- `src/mcp-tool.ts`: adds a second MCP tool handler and response formatter.
- `src/update-cli.ts`: local CLI entry point for update runs.
- `src/types.ts`: adds updater option/report types.

The exporter currently contains private screenshot helpers. Shared capture behavior will be extracted without changing export behavior.

## Error handling

- Missing `manifest.json`: fail the tool call with a clear error.
- Invalid manifest JSON or missing `pages`: fail the tool call with a clear error.
- Per-page screenshot failure: mark only that page as `failed`; continue other pages.
- Existing image invalid in `missing` mode: attempt an update; if update fails, report failure.
- Temporary file cleanup failures are ignored after the primary failure is recorded.

## Testing strategy

Use TDD. Add tests before implementation for:

1. PNG inspection: detects valid, missing, empty, invalid files.
2. Update planning: `missing` skips valid images and updates invalid/missing images.
3. Full/force refresh: updates every manifest page.
4. Replacement safety: failed capture leaves an old file untouched.
5. Report writing: writes `update-report.json` with correct counts/statuses.
6. MCP schema/listing: exposes `update_modao_export_images` with expected parameters.
7. CLI parsing: parses update command arguments.

Existing exporter tests must keep passing.
