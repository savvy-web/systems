# @savvy-web/cli

`@savvy-web/cli` provides the `savvy` binary — the unified developer-tooling CLI for the Silk Suite. Built via `@savvy-web/bundler`.

## Key surface

- Top-level commands: `init`, `check`, `commit`, `changeset`, `lint`, `clean`.
- `savvy init` and `savvy check` are the sole setup/validation entry points (no per-tool init/check subcommands).
- `savvy changeset` group: `lint`, `check` (validates changeset files), `transform`, `validate-file`, `version` (native version bumping via silk-effects' `Changesets.ReleasePlanner.apply` — no `changeset` shell-out, true no-write `--dry-run`), plus `config validate` and `deps detect`/`deps regen` (thin adapters over silk-effects' `Changesets.DepsRegen` — orchestration lives there, not in the CLI).
- Depends only on `@savvy-web/silk-effects` within the repo; must NOT import `@savvy-web/silk` or `@savvy-web/mcp` (the cli↔silk↔mcp non-import invariant).
- Changeset inspection lives in the MCP tools, not the CLI.
- `savvy lint`/`savvy check` sync each consumer `biome.json(c)` `$schema` URL to the hand-pinned `BIOME_VERSION` const in `src/commands/lint/biome-version.ts`. On a Biome upgrade, bump it alongside `@savvy-web/silk`'s peer range and Biome asset `$schema` (see that package's CLAUDE.md).

## Design

Load for the command tree, runtime layer stack, and the native-apply refactor:
→ `@../../.claude/design/cli/architecture.md`
Load when adding a command, changing the runtime layer stack in `src/cli/index.ts`, or touching `savvy changeset version`.
