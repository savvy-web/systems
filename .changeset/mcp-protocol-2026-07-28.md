---
"@savvy-web/mcp": minor
---

## Features

### MCP protocol 2026-07-28

`savvy-mcp` now offers the stateless `2026-07-28` protocol revision (SEP-2575) alongside the stateful `2025-11-25` and `2025-06-18` revisions it already served. A client that discovers the server with `server/discover` gets every tool with no `initialize` handshake and no session; a client that still opens with `initialize` negotiates one of the stateful revisions exactly as before. Claude Code 2.1.278 opens stdio servers with `server/discover`, so it now runs on the new revision.

### Server instructions

The server registers agent-facing `instructions` — what it is for, which tool to reach for first, and the traps around `biome_check`, `changeset_deps_regen` and `repos_manage restore` — surfaced in both the `initialize` result and the `server/discover` result. `SERVER_INSTRUCTIONS` is exported from the package so a host can assert on it. The one-line `description` stays the human summary.

## Refactoring

* The tool registration is rebased on `effect@4.0.0-rc.116`'s `McpServer.registerToolkit`: failures are classified by `Toolkit.FailureOrigin` (parameter validation, declared handler failure, internal), and per-request services come from the new `McpRequestContext`. The wire envelope is unchanged — markdown in `content[0].text`, the typed result in `structuredContent`, a declared failure as `isError` text with no `structuredContent`.

## Tests

* The in-process suite now covers `server/discover`, `tools/list` with no handshake, and a per-revision envelope matrix (success, declared failure, invalid params) across all three revisions.
