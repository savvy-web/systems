---
"@savvy-web/mcp": minor
---

## Features

### savvy-mcp server

`@savvy-web/mcp` is the Silk Suite MCP server: the `savvy-mcp` binary starts a stdio Model Context Protocol server that exposes Silk tooling and library knowledge to coding agents. It is spawned by the Silk Suite Claude Code plugins and shares the `@savvy-web/silk-effects` business logic with the `savvy` CLI.

It exposes:

- **`workspace_info` tool** — returns a structured snapshot of the current Silk workspace: runtime, package manager, and a per-workspace summary (name, version, publishability, versioning/tag/release state, and linked/fixed group membership by name). The result is delivered both as a markdown summary and as typed structured JSON. The server resolves the workspace root by walking up from its launch directory, so the tool works even when started from a subdirectory; override the base directory with a bin argument or the `SAVVY_MCP_PROJECT_DIR` environment variable.
- **`silk://catalog` resource** — a curated catalog of Silk knowledge grouped by tier (Standards, Packages, Guides), each entry carrying a "load when" hint so agents read the catalog first and fetch only the resource a task needs. The catalogued documents are served under `silk://standards/*`, `silk://packages/<pkg>/*`, and `silk://guides/*`.

The server is built on `@modelcontextprotocol/sdk` with Effect-based service wiring over `@savvy-web/silk-effects`. Effect Schema is the source of truth for tool input and output, bridged to Zod only at the MCP registration boundary.
