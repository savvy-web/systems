# @savvy-web/mcp

`@savvy-web/mcp` is the spawnable `savvy-mcp` server — a standalone tools-only MCP server (not a discovery host) exposing Silk tooling over silk-effects. No resource/corpus layer. Built via `@savvy-web/bundler`.

## Key surface

- Tools (eight): six read-only — `workspace_info` (structured workspace analysis: linked/fixed package groups + resolved registry targets), `turbo_inspect` (mode cache|graph|affected over `turbo --dry`), `changeset_inspect` (mode branch|config|classify), `changeset_validate` (validates `.changeset/` files), `changeset_preview` (non-destructive release render over `Changesets.ReleasePlanner.preview`), `changeset_deps_detect` (detects dependency drift over `Changesets.DepsRegen`) — plus two mutating tools, the sanctioned exceptions to the read-only convention: `biome_check` (runs Biome with `--reporter=gitlab`, mode check|lint, `write`/`unsafe` to apply fixes) and `changeset_deps_regen` (regenerates dependency changesets over `Changesets.DepsRegen`).
- All tools are backed by the same `silk-effects` services the `savvy` CLI uses.
- Depends only on `@savvy-web/silk-effects` within the repo; must NOT import `@savvy-web/cli` or `@savvy-web/silk`.
- NO `peerDependencies` block: the Effect closure is sealed as regular `dependencies` (same posture as cli and tsdown-plugins, #228). When adding a new `@effect/*` dep, declare its required peers as regular deps too.

## Design

Load for the runtime layer and the tool implementations:
→ `@../../.claude/design/mcp/architecture.md`
Load when adding a tool or changing the runtime layer.
