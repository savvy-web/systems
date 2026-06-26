# @savvy-web/mcp

[![npm](https://img.shields.io/npm/v/@savvy-web%2Fmcp?label=npm&color=cb3837)](https://www.npmjs.com/package/@savvy-web/mcp)
[![License: MIT](https://img.shields.io/badge/License-MIT-4caf50.svg)](https://opensource.org/licenses/MIT)

The `savvy-mcp` [Model Context Protocol](https://modelcontextprotocol.io/) server. It serves [Silk Suite](https://github.com/savvy-web/systems) tooling and library knowledge to coding agents as structured tools and a curated documentation corpus, so an agent can read workspace facts and Silk docs instead of parsing console output or guessing.

## Install

```bash
npm install --save-dev @savvy-web/mcp
# or
pnpm add -D @savvy-web/mcp
```

The Silk Suite Claude Code plugins spawn this server for you, so you rarely install it directly. Installing [`@savvy-web/silk`](https://www.npmjs.com/package/@savvy-web/silk) also brings it in.

## Quick start

The server speaks MCP over stdio and is meant to be spawned by an MCP client. A client declares it like this:

```json
{
  "mcpServers": {
    "savvy-mcp": {
      "command": "savvy-mcp",
      "args": ["."]
    }
  }
}
```

The single positional argument is the project directory; if omitted, the server resolves it from `SAVVY_MCP_PROJECT_DIR`, then `CLAUDE_PROJECT_DIR`, then the current working directory.

To exercise it by hand during development, run it through the MCP inspector:

```bash
npx @modelcontextprotocol/inspector savvy-mcp .
# opens the inspector UI against a live savvy-mcp instance
```

## Tools

- `workspace_info` — returns a flat, structured projection of the workspace analysis: linked and fixed package groups as name arrays plus resolved registry targets. Backed by the same `silk-effects` analyzer the `savvy` CLI uses.
- `silk_docs_search` — ranks documents in the corpus against a plain keyword or phrase query and returns hits with a normalized confidence score plus a high/medium/low label. A query that matches nothing returns an empty result set, pointing the agent at `silk://catalog` to choose a doc by reasoning.
- `turbo_inspect` — read-only Turborepo inspection over `turbo --dry`: diagnose a task's per-package cache hits, derive the task graph or list the packages affected by recent changes. It never runs a task. Backed by the same `silk-effects` `Turbo` inspector an agent would otherwise drive by hand.
- `changeset_inspect` — read-only changeset analysis for release work: `mode=branch` diffs the current branch against its base and attributes every changed file to its owning package, `mode=config` surfaces the resolved `.changeset/config.json` with its release surfaces, version files and ignore list, and `mode=classify` reports how the branch's pending changesets classify each package's bump. It never writes a changeset. Backed by the same `silk-effects` changeset services the `savvy` CLI uses.
- `changeset_validate` — read-only validation of the files in a changeset directory against the section-aware rules, returning typed diagnostics (file, rule, line, column, message) plus an ok flag and error count. Use it instead of shelling out to `savvy changeset lint`.
- `changeset_preview` — read-only preview of the next release: it runs the genuine changesets engine over the pending changesets and returns each package's version bump (old to new) plus the rendered CHANGELOG block, exactly as it would ship. It never mutates the repo. Backed by the same `silk-effects` release planner the `savvy changeset version` command applies.
- `biome_check` — run Biome over a path and get structured diagnostics back: `mode=check` (lint, format and organize-imports) or `mode=lint`. Unlike the other tools it can mutate — pass `write` for safe fixes or `unsafe` for unsafe ones (both git-reversible) — so it returns the same diagnostics the Biome LSP surfaces for files you have edited.

## Resources

The server exposes a curated markdown corpus behind the `silk://` URI scheme:

- `silk://catalog` — a single fixed resource listing every document grouped by tier with a "load when …" hint. The agent's mandated first read.
- `silk://{+path}` — a template resolving any document by its stable id, covering Silk development standards (`silk://standards/<topic>`), per-package API and usage docs (`silk://packages/<pkg>/<topic>`) and conceptual guides (`silk://guides/<slug>`).

Per-package API-reference docs under `silk://packages/<pkg>/api/*` are generated from API Extractor models and shipped with the package, with a bare `silk://packages/<pkg>/api` index page listing each package's symbols.

## License

[MIT](LICENSE)
