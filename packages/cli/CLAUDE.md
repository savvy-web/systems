# @savvy-web/cli

`@savvy-web/cli` provides the `savvy` binary — the unified developer-tooling CLI for the Silk Suite. Built via `@savvy-web/bundler`.

## Key surface

- Top-level commands: `init`, `check`, `commit`, `changeset`, `lint`, `clean`, `repos` (the `repos` group — vendored `.repos/` reference repos — is an intentional expansion of the original six).
- `savvy init` and `savvy check` are the sole setup/validation entry points (no per-tool init/check subcommands).
- `savvy changeset` group: `lint`, `check` (validates changeset files), `transform`, `validate-file`, `version` (native version bumping via silk-effects' `Changesets.ReleasePlanner.apply` — no `changeset` shell-out, true no-write `--dry-run`), plus `config validate` and `deps detect`/`deps regen` (thin adapters over silk-effects' `Changesets.DepsRegen` — orchestration lives there, not in the CLI).
- `savvy init` writes `@savvy-web/changelog` as the canonical `.changeset/config.json` changelog id; `savvy check` still accepts the prior silk shim subpath (`@savvy-web/silk/changesets/changelog`) and the pre-merge `@savvy-web/changesets/changelog`.
- Depends only on `@savvy-web/silk-effects` within the repo; must NOT import `@savvy-web/silk` or `@savvy-web/mcp` (the cli↔silk↔mcp non-import invariant).
- Kit surfaces come from `@effected/*` directly, never re-exported through silk-effects: `AppLive` builds `ToolDiscovery.layer` (`@effected/commands`) over `Workspaces.localExecLayer()` and merges `ManagedSection.layer` (`@effected/templates`); `savvy commit check` classifies with `VersioningStrategy.detect` (`@effected/workspaces`) — a value class, so `classify` is total and there is no detection error to catch.
- NO `peerDependencies` block: the Effect closure is sealed as regular `dependencies` (same posture as mcp and tsdown-plugins, #228). When adding a new `@effect/*` dep, declare its required peers as regular deps too.
- Changeset inspection lives in the MCP tools, not the CLI.
- `savvy lint fmt <name>` subcommands own argument parsing and file I/O ONLY. The formatting itself lives in silk-effects (e.g. `Lint.PnpmWorkspace.formatContent`) so the CLI and the lint-staged handler cannot drift; never inline a second copy of a format step here.
- `savvy lint`/`savvy check` sync each consumer `biome.json(c)` `$schema` URL to the hand-pinned `BIOME_VERSION` const in `src/commands/lint/biome-version.ts`. On a Biome upgrade, bump it alongside `@savvy-web/silk`'s peer range and Biome asset `$schema` (see that package's CLAUDE.md).

## Design

Load for the command tree, runtime layer stack, the native-apply refactor, and why some command groups carry a hand-written type annotation:
→ `@../../.claude/design/cli/architecture.md`
Load when adding a command, changing the runtime layer stack in `src/cli/index.ts`, hitting a TS4023 error on a command group, touching `savvy changeset version`, or adding a handler test — the "Testing the command handlers" section covers the sanctioned `layer(Logger.layer([]))` silencing block and why an output assertion's capture mechanism decides `it.effect` vs `it.live`.
