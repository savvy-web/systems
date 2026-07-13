# @savvy-web/mcp

[![npm](https://img.shields.io/npm/v/@savvy-web%2Fmcp?label=npm&color=cb3837)](https://www.npmjs.com/package/@savvy-web/mcp)
[![License: MIT](https://img.shields.io/badge/License-MIT-4caf50.svg)](https://opensource.org/licenses/MIT)

The `savvy-mcp` [Model Context Protocol](https://modelcontextprotocol.io/) server. It serves [Silk Suite](https://github.com/savvy-web/systems) tooling to coding agents as structured tools, so an agent can read workspace facts and run Silk checks instead of parsing console output or guessing. It is a tools-only server — ten tools, no resources.

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
- `turbo_inspect` — read-only Turborepo inspection over `turbo --dry`: diagnose a task's per-package cache hits, derive the task graph or list the packages affected by recent changes. It never runs a task. Backed by the same `silk-effects` `Turbo` inspector an agent would otherwise drive by hand.
- `changeset_inspect` — read-only changeset analysis for release work: `mode=branch` diffs the current branch against its base and attributes every changed file to its owning package, `mode=config` surfaces the resolved `.changeset/config.json` with its release surfaces, version files and ignore list, and `mode=classify` reports how the branch's pending changesets classify each package's bump. It never writes a changeset. Backed by the same `silk-effects` changeset services the `savvy` CLI uses.
- `changeset_validate` — read-only validation of the files in a changeset directory against the section-aware rules, returning typed diagnostics (file, rule, line, column, message) plus an ok flag and error count. Use it instead of shelling out to `savvy changeset lint`.
- `changeset_preview` — read-only preview of the next release: it runs the genuine changesets engine over the pending changesets and returns each package's version bump (old to new) plus the rendered CHANGELOG block, exactly as it would ship. It never mutates the repo. Backed by the same `silk-effects` release planner the `savvy changeset version` command applies.
- `changeset_deps_detect` — read-only preview of the cumulative dependency diff (merge-base to working tree): one entry per affected workspace package with its resolved dependency-table rows, `catalog:`/`workspace:` specifiers resolved to concrete versions. It never writes a changeset. Backed by `silk-effects`' `Changesets.DepsRegen.plan`.
- `changeset_deps_regen` — regenerates pure-dependency changesets: deletes stale ones and writes fresh single-package, patch-bump changesets from the cumulative dependency diff. Mutating unless `dryRun` is set, in which case it reports what it would delete and write without touching the filesystem. Backed by `silk-effects`' `Changesets.DepsRegen`.
- `biome_check` — run Biome over a path and get structured diagnostics back: `mode=check` (lint, format and organize-imports) or `mode=lint`. Unlike most of the other tools it can mutate — pass `write` for safe fixes or `unsafe` for unsafe ones (both git-reversible) — so it returns the same diagnostics the Biome LSP surfaces for files you have edited.
- `repos_inspect` — read-only inspection of vendored repositories: `mode=status` reports clone status, remotes and current revision per repo; `mode=config` surfaces the validated `.repos/config.json` manifest and its entries. Returns markdown-escaped output since vendored-repo content is untrusted input. Backed by the same `silk-effects` `Repos` services the `savvy` CLI uses.
- `repos_manage` — manages vendored repositories (mutating unless `dryRun` is set): `action=sync` clones/pulls/configures remotes per the manifest; `action=pin` locks the current revision; `action=add` adds a new repo entry; `action=note` appends a short note to a repo. Backed by the same `silk-effects` `Repos` services the `savvy` CLI uses.

## License

[MIT](LICENSE)
