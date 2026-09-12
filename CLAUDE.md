# Silk Suite Systems

Coordination hub for the Silk Suite open-source ecosystem.

## Packages

Each package has its own `CLAUDE.md` (auto-loaded when you work in its subtree) and a design doc under `.claude/design/<pkg>/`. App packages form a strict layered graph (L4 silk → L3 cli/mcp/changelog → L2 silk-effects → L1 silk-core), asserted by `@e2e/workspace` against its `layers.json`:
→ `@./.claude/design/workspace/package-layering.md`
Load when adding a `workspace:*` edge between packages or moving code across a layer.

- **silk-core** (`@savvy-web/silk-core`) — L1 domain core: platform-free schemas, tagged errors, the `PrBody` contract. See `packages/silk-core/CLAUDE.md`.
- **silk-effects** (`@savvy-web/silk-effects`) — L2 engine: shared Effect library and dev-tooling business-logic core (`Changesets`/`Commitlint`/`Lint`/`Turbo`/`Repos`); re-exports silk-core. See `packages/silk-effects/CLAUDE.md`.
- **cli** (`@savvy-web/cli`) — the `savvy` binary (`init`/`check`/`commit`/`changeset`/`lint`/`clean`/`repos`). See `packages/cli/CLAUDE.md`.
- **mcp** (`@savvy-web/mcp`) — the spawnable `savvy-mcp` server: an Effect-native `McpServer` (`effect/unstable/ai`), one Layer over stdio, ten tools, no resources. See `packages/mcp/CLAUDE.md`.
- **silk** (`@savvy-web/silk`) — the single install-target of config-integration shims + Biome asset, AND the carrier of the `savvy`/`savvy-mcp` bins. See `packages/silk/CLAUDE.md`.
- **changelog** (`@savvy-web/changelog`) — the standalone changesets changelog generator; the installable identity for silk-effects' `Changesets.changelogFunctions` and the canonical `.changeset/config.json` changelog id. See `packages/changelog/CLAUDE.md`.
- **bundler** (`@savvy-web/bundler`) — tsdown-based build orchestrator (`defineBuild`/`runBuild`). See `packages/bundler/CLAUDE.md`.
- **tsdown-plugins** (`@savvy-web/tsdown-plugins`) — the interface-only tsdown/rolldown plugin pack the bundler orchestrates. See `packages/tsdown-plugins/CLAUDE.md`.
- **rspress-builder** (`@savvy-web/rspress-builder`) — RSPress plugin builder, a thin bundler sibling. See `packages/rspress-builder/CLAUDE.md`.
- **templates** (`@savvy-web/templates`) — pure-function project scaffolding. See `packages/templates/CLAUDE.md`.
- **github-action-builder** (`@savvy-web/github-action-builder`) — zero-config rsbuild tool for Node.js 24 GitHub Actions. See `packages/github-action-builder/CLAUDE.md`.
- **pnpm-plugin-silk** (`@savvy-web/pnpm-plugin-silk`) — the unified pnpm config dependency distributing the purpose-scoped catalogs and install-time policy across the ecosystem. See `packages/pnpm-plugin-silk/CLAUDE.md`.

`e2e/*` is a separate harness area of PRIVATE, test-only packages (`@e2e/bundler`, `@e2e/pnpm-plugin-silk`, `@e2e/silk`, `@e2e/workspace`) — distinct from the published `packages/*` — that exercise built `dist/dev` artifacts against isolated fixtures (`@e2e/workspace` asserts the layering). See `e2e/CLAUDE.md`.

Also in this repo: the `plugins/silk` Claude Code plugin (the repo's only plugin; `plugins/github-actions` was removed), the placeholder docs site (`docs/`), cross-repo planning, and the plugin marketplace entry point (`.claude-plugin/`).

## Tech Stack

- **Runtime:** Node.js 24.11.0+
- **Package Manager:** pnpm 11.22.0 with `@savvy-web/pnpm-plugin-silk` config dependency
- **Build:** Turborepo orchestration; `@savvy-web/bundler` builds all twelve packages (bundler + tsdown-plugins self-host via their escape-hatch `savvy.build.ts`, the other ten via the front door — `build()`/`defineBuild`/`runBuild`; `pnpm-plugin-silk` uses the `build()` entry); build scripts run `node savvy.build.ts` (Node 24+ native type-stripping), except `tsdown-plugins` which bootstraps via `tsx`
- **Effect:** the whole repo is on Effect v4 (`catalog:effect` / `catalog:effect:peers`). Catalogs come from the `@effected/pnpm-plugin-effect` config dependency, which as of `0.6.0` publishes four: `effect`/`effect:peers` and `effected`/`effected:peers`. There is no `effect3` catalog — it was removed upstream and no manifest here resolves against it. Bumping this config dependency has a trap: see `@./.claude/design/silk-effects/kit-peer-dependencies.md` and savvy-web/systems#536. `effect` core source is vendored at `.repos/effect` (pinned to the catalog tag) — the authority for v4 APIs — from `Effect-TS/effect` itself, NOT the archived `effect-smol` repo; `.repos/config.json` is the live record of url/ref/sparse paths. The `@effected/*` kit packages the suite consumes come from the npm registry (re-derive the list from the manifests, never from memory)
- **Linting:** Biome, markdownlint
- **Testing:** Vitest via `@vitest-agent/plugin`; a test that runs an Effect takes `describe`/`it`/`expect` from `@effect/vitest` (`catalog:effect`), one with no Effect surface stays on plain `vitest`, and `vi` always comes from `"vitest"` (hoisting). A test needing a `FileSystem` builds an `@effected/memfs` volume, not a hand-rolled stub. Built-artifact e2e harness in `e2e/*`; the silk plugin's hook shell suite (bats + shellcheck) under `plugins/silk/tests`, run by `pnpm test:hooks`
- **Commits:** Conventional commits with DCO signoff via `@savvy-web/commitlint`. Bodies stay short (the repo squash-merges, so a long body is discarded) — use `/silk:commit-create`. A PR body is markdown, NOT held to the commit contract: only `plan-leakage`/`closes-trailer` gate it, so headers and fences are fine — use `/silk:pr-body`.
- **Releases:** `@savvy-web/changesets`

## Key Commands

```bash
pnpm build          # Build all packages (dev + prod)
pnpm test           # Run tests
pnpm typecheck      # Type-check all packages
pnpm lint           # Biome check
pnpm lint:fix       # Biome auto-fix
pnpm lint:md        # Markdown lint
```

`npx biome` is a false green: it resolves to an unrelated npm package (`0.3.3`) that no-ops and exits 0, so `npx biome check --write` reports success while checking nothing (real Biome prints `Version: 2.5.9`). Worse, ANY direct Biome invocation — bare, path-prefixed, `pnpm exec biome`, `npx @biomejs/biome`, `sudo biome`, every other route — skips this repo's config, walks straight into the `.repos/**` vendored worktrees (git-managed, chmodded read-only by `Repos.ReposLockdown`) and can corrupt them or die on `EACCES`. The `plugins/silk` `biome-direct-deny` PreToolUse hook denies every direct route, keyed on the script name across pnpm/yarn/bun/npm. Use the `mcp__plugin_silk_savvy-mcp__biome_check` MCP tool or the three sanctioned root scripts `pnpm lint` / `pnpm lint:fix` / `pnpm lint:fix:unsafe` (any package manager). Those can fail transiently with `Failed to resolve the configuration from @savvy-web/silk/biome` while silk's `dist/dev` is mid-rebuild — the known rebuild race, not a config error; retry rather than "fixing" the config.

## Install & Build Orchestration

Build runs on install, but NOT from the root: the root `prepare` is `husky` and nothing else. Each workspace-dependency package carries its OWN `prepare: turbo run build:dev`, run per package during `pnpm install`; consumers resolve it through a `link:` into `dist/dev/pkg` (`publishConfig.directory` + `linkDirectory: true`). `pnpm build` produces the prod outputs.

A package needs `"prepare": "turbo run build:dev"` whenever it is a `workspace:*` dependency of ANY other `package.json` — root, sibling, or `e2e/*` fixture. Re-derive the set rather than trusting a list: `grep -rl '"@savvy-web/<name>": "workspace:\*"' package.json packages/*/package.json e2e/*/package.json`.

DO NOT delete these scripts. Agents repeatedly remove them as redundant, reasoning that turbo's `dependsOn` already orders the build. It does not: `dependsOn` only orders builds turbo was ALREADY asked to run, has no say over whether a `prepare` fires, and never reaches `pnpm install`'s linking step. Absence of breakage is not evidence the script is unnecessary. The failure mode is `Cannot find package '@savvy-web/<name>'` from anything resolving outside the task graph; `@savvy-web/changelog` hit exactly this and broke `changeset version` / `changeset_preview`. For the same reason `@savvy-web/changelog` must stay a root devDependency (the changesets engine resolves the changelog id from the repo root). The root's only other workspace devDependency is `@savvy-web/silk`, which carries the `savvy`/`savvy-mcp` bins — `@savvy-web/cli` and `@savvy-web/mcp` are NOT root devDependencies; do not re-add them.

Do NOT add `injectWorkspacePackages` or `syncInjectedDepsAfterScripts` to `pnpm-workspace.yaml` — injection hard-links `dist/dev` before `prepare` has built it, so a frozen install aborts with `ENOENT`. A `dist/dev` or `node_modules/@savvy-web/*` link missing mid-test-run is the vitest `globalSetup` rebuilding — transient; let the run finish, then re-check.

**Full wiring — package-scripts contract, workspace settings, root devDependencies, the `savvy` bin path:**
→ `@./.claude/design/workspace/install-orchestration.md`
Load when editing any `package.json` scripts or devDependencies, `pnpm-workspace.yaml`, or debugging a `Cannot find package '@savvy-web/*'` error.

## Ecosystem Context

This repo is the hub of the Silk Suite ecosystem: 33 repositories in 7 layers (Foundation Libraries → Package Management → Build Systems → Developer Experience → CI/CD Pipeline → AI/Agent Tooling → Documentation & Templates).

- `@savvy-web/pnpm-plugin-silk` provides the version catalogs every repo consumes
- The GitHub Actions consume `@effected/github-actions` (and the kit) directly; savvy-specific action logic routes through `@savvy-web/silk-effects`. `@savvy-web/github-action-effects` is DELETED (archived under `.claude/design/_archive/`) — any reference to it is stale
- `.github-private` houses org-level reusable workflows

## Conventions

- Source `package.json` `"private": true` is transformed by builders based on `publishConfig.access`.
- Catalogs are purpose-scoped: `catalog:build`, `catalog:docs`, `catalog:lint`, `catalog:silk`, `catalog:test`, each with a `<name>:peers` companion for peer ranges (the camelCase `<name>Peers` spelling is GONE). `effect` and `@effect/*` come from `catalog:effect`/`catalog:effect:peers`, supplied by `@effected/pnpm-plugin-effect`.
- Verify any Effect API against the vendored `.repos/effect` source or the installed release, never v3 memory. Vendored WORKTREES are OS-level read-only (`Repos.ReposLockdown`) and local git config declares them off-limits (`submodule.<path>.update = none`); the submodule gitdir stays writable on purpose so ordinary git and GUI clients keep working. An `EACCES` there means route the change through `savvy repos` / the `repos_manage` MCP tool — never `chmod` the tree back by hand. A `git checkout` inside a vendored tree is NOT blocked, so drift is detected, not prevented: `savvy repos status --drift` reports it, `savvy repos restore` repairs it.
- All Effect code uses class-based `Context.Service` services (each exporting a companion `*Shape` interface), `Schema.Class`/`Schema.TaggedClass`, `Data.TaggedError`.
- README.md is for external users; `.claude/design/` for architecture docs.
- The non-import invariant: `@savvy-web/cli`, `@savvy-web/silk`, and `@savvy-web/mcp` must NOT import each other — cli and mcp are L3 peers depending only on `@savvy-web/silk-effects` in-repo. ONE sanctioned exception: silk's `src/bin/savvy.ts` and `src/bin/savvy-mcp.ts` (the carrier shims) import `@savvy-web/cli/main` and `@savvy-web/mcp/main`; nothing else under silk's `src/` may.
- All packages version INDEPENDENTLY — `.changeset/config.json` has no `fixed` or `linked` arrays. silk/cli/mcp/changelog are NOT a fixed group, but silk stays exactly pinned to the other three automatically: silk declares them — and `@savvy-web/silk-effects`, a real runtime dependency (nine `src/` files import it) — as source `dependencies` (`workspace:*`), published as EXACT-pinned regular `dependencies`, never promoted to peers (peer publishing made pnpm `autoInstallPeers` propagate their Effect graph into consumers at wrong versions). The bins reach consumers through silk's own `bin` map, not hoisting: `@savvy-web/pnpm-plugin-silk` no longer hoists cli/mcp, only `@savvy-web/changelog`, which the changesets engine resolves BY ID from the consumer root. Changesets reads `workspace:*` as the exact current version, so a cli/mcp/changelog release auto-PATCH-bumps silk (`updateInternalDependencies: patch`) and re-pins it; plain `dependencies` (never source peerDependencies) means silk is NOT force-major-bumped. silk's `versionFiles` glob still bumps the `plugins/*` manifests in lockstep with silk.
- Integration/e2e tests must NOT resolve `catalog:`/`workspace:` against the host workspace — catalog-resolution coverage lives in `e2e/` via subprocess builds against isolated fixtures (`CatalogResolver` reads `process.cwd()`). See `e2e/CLAUDE.md`.
- `@savvy-web/bundler`, `@savvy-web/rspress-builder`, and `@savvy-web/tsdown-plugins` version independently (no longer a linked group); changesets still auto-bumps the bundler when tsdown-plugins changes.
- `@savvy-web/pnpm-plugin-silk` versions independently and is npm-registry-only (the one package not also on GitHub Packages).

## Dogfooding `@effected`

A dogfood round consumes the `@effected/*` kit (`spencerbeggs/effected`, sibling checkout at `../../spencerbeggs/effected`) from LOCAL prod artifacts via `pnpm-workspace.yaml` `overrides:` entries of the form `"@effected/<name>": "file:../../..."`. Check that block before assuming a round is open — `overrides:` also carries unrelated pins, so look for `@effected` `file:` entries specifically. **Currently UNLINKED:** there are none, every manifest resolves from the registry, and normal push/PR rules apply.

While `@effected` `file:` overrides are active the branch does NOT push or open PRs — the paths exist only on this machine (the silk plugin's `dogfood-guard` hook denies it). Verify kit signatures against `../../spencerbeggs/effected/packages/<name>/src` or the installed `.d.ts` under `node_modules/@effected/<name>/`, never from relayed summaries.

**The full protocol — linking, mailbox layout and ids, the refresh sequence, the exit:**
→ `@./.claude/design/silk/plugin-dogfood.md`
Load when opening, running, or closing a dogfood round (its "Repo-level convention" section is the pattern).

## Design Documentation

Design docs live in `.claude/design/` (tracked). Per-package pointers live in each `packages/<pkg>/CLAUDE.md`; these cover topics with no package subtree to auto-load from:

**`plugins/silk` — the merged Claude Code plugin (overview/index):**
→ `@./.claude/design/silk/plugin.md`
Load when working on `plugins/silk` (layout, capability map, skill naming, MCP server wiring). Per-capability child docs — load the one you are touching:
→ `@./.claude/design/silk/plugin-hooks.md` — hook registration, shared hook infrastructure, the SessionStart orientation payload.
→ `@./.claude/design/silk/plugin-changesets.md` — the changeset router skill, `changeset-manager` agent, validator and Stop-time nudge.
→ `@./.claude/design/silk/plugin-commit-messages.md` — `commit-create`/`pr-body` skills and the `savvy commit hook` guards.
→ `@./.claude/design/silk/plugin-biome.md` — the three Biome channels (LSP, `biome_check`, sanctioned Bash) and the `biome-direct-deny` guard.
→ `@./.claude/design/silk/plugin-turbo.md` — the read-only Turborepo capability over `turbo_inspect`.
→ `@./.claude/design/silk/plugin-build-tsdoc.md` — `build`/`tsdoc` skills, the `tsdoctor` agent, the `tsdoc-diagnostics` monitor over `issues.json`.
→ `@./.claude/design/silk/plugin-repos.md` — the vendored-repos skill, orientation block, PreToolUse guards, and drift monitor.
→ `@./.claude/design/silk/plugin-dogfood.md` — the dogfood-mailbox protocol.
→ `@./.claude/design/silk/plugin-it2.md` — the it2 pane-orchestration skill.

**Suite-wide test conventions (`@effect/vitest`, filesystem doubles):**
→ `@./.claude/design/testing/effect-vitest.md`
Load before writing or converting any test that runs an Effect or needs a `FileSystem`. Covers `it.effect` vs `it.live` vs suite-boundary `layer(...)` (memoizes, bleeding test-double state — per-test `Effect.provide` is the default), `Effect.flip` for typed failures, the `TestClock`/`TestConsole` swaps, and the `@effected/memfs` rules — `layerWith` volumes over hand-rolled stubs, `layerFaulty` for one failing operation, the per-BUILD volume-sharing trap that makes a write-then-read assertion pass vacuously, and the mode-enforcement carve-out that keeps some blocks on real tmpdirs.
