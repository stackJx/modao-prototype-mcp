# Remote MCP Service Design

## Goal

Add a remote HTTP service mode to `/root/book/modao-prototype-mcp` so MCP clients can connect over the network while the existing stdio MCP entrypoint continues to work unchanged.

## Selected Approach

Use option A + C: expose a token-protected remote service and support both modern Streamable HTTP and legacy HTTP+SSE transports.

## Requirements

- Keep `src/index.ts` as the existing stdio MCP entrypoint.
- Add a new HTTP entrypoint that can be started independently.
- Expose `GET /health` for unauthenticated health checks.
- Expose `/mcp` for Streamable HTTP MCP requests (`GET`, `POST`, `DELETE`).
- Expose `/sse` and `/messages` for legacy HTTP+SSE MCP clients.
- If `MCP_TOKEN` is set, require `Authorization: Bearer <MCP_TOKEN>` for `/mcp`, `/sse`, and `/messages`.
- If `MCP_TOKEN` is not set, allow unauthenticated MCP requests for local/internal testing.
- Configure bind address and port with `HOST` and `PORT`, defaulting to `0.0.0.0` and `3000`.
- Reuse the existing `export_modao_prototype` and `update_modao_export_images` tool behavior.
- Add npm scripts and README documentation for remote startup and client configuration.

## Architecture

Split server construction from transport startup. A reusable factory registers the Modao MCP tools on a fresh `McpServer` instance. The existing stdio entrypoint uses this factory with `StdioServerTransport`. The new HTTP entrypoint uses the same factory per remote session with MCP SDK HTTP transports.

The HTTP service uses the SDK's Express-compatible helper because it already ships with the SDK dependency. It keeps an in-memory transport map keyed by session id. Streamable HTTP sessions use `StreamableHTTPServerTransport`. SSE sessions use `SSEServerTransport` and the `/messages?sessionId=...` endpoint.

## Data Flow

1. Remote client calls `GET /health` to verify the process is running.
2. Remote client initializes over `/mcp`, or opens `/sse` and posts to `/messages` for older clients.
3. Auth middleware checks bearer token for MCP endpoints when `MCP_TOKEN` exists.
4. The HTTP route creates or reuses the correct transport for the session.
5. A fresh Modao MCP server instance registers existing tools and connects to the transport.
6. Tool calls invoke existing exporter/updater code and return the same JSON text payloads as stdio mode.

## Error Handling

- Missing or invalid bearer token returns HTTP 401 JSON.
- Unknown Streamable HTTP sessions return an MCP JSON-RPC error response.
- Requests that mix SSE and Streamable HTTP session ids return HTTP 400.
- Unexpected route errors return HTTP 500 if headers have not already been sent.
- Shutdown closes all active transports before process exit.

## Testing

Use TDD. Add tests for environment parsing and bearer token authorization before writing production code. Preserve the current full test suite. Verify the HTTP service starts locally and returns a healthy response.

## Repository Constraints

`/root/book/modao-prototype-mcp` is not inside a valid git repository, so worktree isolation and commits are unavailable. Work proceeds in place.
