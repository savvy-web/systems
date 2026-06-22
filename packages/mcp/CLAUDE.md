# @savvy-web/mcp

`@savvy-web/mcp` is the spawnable `savvy-mcp` server — a standalone MCP server (not a discovery host) exposing Silk tooling over silk-effects. Built via `@savvy-web/bundler`.

## Key surface

- Tools (seven): six read-only — `workspace_info`, `silk_docs_search`, `turbo_inspect` (mode cache|graph|affected), `changeset_inspect` (mode branch|config|classify), `changeset_validate` (validates `.changeset/` files), `changeset_preview` (non-destructive release render over `Changesets.ReleasePlanner.preview`) — plus the one mutating tool `biome_check` (runs Biome with `--reporter=gitlab`, mode check|lint, `write`/`unsafe` to apply fixes; the intentional exception to the read-only convention).
- Resource layer: `silk://catalog` plus a `silk://{+path}` template over a compiled markdown corpus, including `silk://standards/turbo/*` and the generated `silk://packages/<pkg>/api/*` API-reference docs. The corpus documents seven library packages (`API_TARGETS` in `lib/scripts/api-targets.ts`): silk-effects, templates, github-action-effects, github-action-builder, bundler, tsdown-plugins, rspress-builder — bundler/tsdown-plugins/rspress-builder were added this run; silk/cli/mcp are deliberately excluded.
- API docs are rendered at build time via the external `api-extractor-llms` npm package (a build-time devDependency); rendered markdown is tracked source, only the `.api.json` models under `lib/models/` are gitignored.
- Build-time catalog compiler emits the tracked `manifest.json` behind a deep-equality write guard.
- Depends only on `@savvy-web/silk-effects` within the repo; must NOT import `@savvy-web/cli` or `@savvy-web/silk`.

## Design

Load for the runtime layer, tool half, resource half, and the API-doc tier:
→ `@../../.claude/design/mcp/architecture.md`
Load when adding a tool/resource, changing the runtime layer, or working on the manifest/API-doc pipeline.
