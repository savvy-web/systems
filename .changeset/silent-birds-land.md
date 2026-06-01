---
"@savvy-web/mcp": minor
---

## Features

### savvy-mcp server

`@savvy-web/mcp` is the Silk Suite MCP server: the `savvy-mcp` binary starts a stdio Model Context Protocol server that exposes Silk tooling and library knowledge to coding agents. It is spawned by the Silk Suite Claude Code plugins and shares the `@savvy-web/silk-effects` business logic with the `savvy` CLI.

It exposes:

- **`workspace_info` tool** — returns a structured snapshot of the current Silk workspace: runtime, package manager, and a per-workspace summary (name, version, publishability, versioning/tag/release state, and linked/fixed group membership by name). The result is delivered both as a markdown summary and as typed structured JSON. The server resolves the workspace root by walking up from its launch directory, so the tool works even when started from a subdirectory; override the base directory with a bin argument or the `SAVVY_MCP_PROJECT_DIR` environment variable.
- **`silk_docs_search` tool** — a read-only intent search across the Silk documentation corpus using an in-memory Fuse index over each document's title, tags, and summary (the body is not indexed at launch). Accepts a plain-keyword query plus optional `limit` and `tier` filters; returns ranked matches with the document URI, title, summary, tags, and a normalized high/medium/low confidence label, tie-broken by curated priority. It never returns empty — a no-match query falls back to the top entries with a catalog nudge. Agents use this to locate the right document before fetching it with the resource layer.
- **`silk://catalog` resource** — a curated catalog of Silk knowledge grouped by tier (Standards, Packages, Guides), each entry carrying a "load when" hint so agents read the catalog first and fetch only the resource a task needs.
- **`silk://{+path}` resource template** — serves individual documents from the on-disk corpus by URI path. Documents live under `silk://standards/*`, `silk://packages/<pkg>/*`, and `silk://guides/*`; the catalog lists every addressable path.

The document corpus (16 launch docs) is compiled at build time by a `build:catalog` script into a validated `manifest.json`. At runtime the server hydrates the Fuse search index from the manifest and serves each document on demand through the resource template.

The `McpContext` public export now carries the resource layer, so the barrel also re-exports the types reachable through it — `DocIndex`, `Manifest`, `ManifestEntry`, `SearchResult`, and `SearchOptions` — letting consumers that embed or extend the server work with the manifest and search shapes directly.

The server is built on `@modelcontextprotocol/sdk` with Effect-based service wiring over `@savvy-web/silk-effects`. Effect Schema is the source of truth for tool input and output, bridged to Zod only at the MCP registration boundary.
