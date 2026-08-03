# Silk Suite Systems

Coordination hub for the Silk Suite open-source ecosystem by Savvy Web Systems.

## Packages

Each package has its own `CLAUDE.md` (auto-loaded when you work in its subtree) and a design doc under `.claude/design/<pkg>/`.

- **silk-effects** (`@savvy-web/silk-effects`) — shared Effect library and dev-tooling business-logic core (`Changesets`/`Commitlint`/`Lint`/`Turbo`). See `packages/silk-effects/CLAUDE.md`.
- **cli** (`@savvy-web/cli`) — the `savvy` binary (`init`/`check`/`commit`/`changeset`/`lint`/`clean`/`repos`). See `packages/cli/CLAUDE.md`.
- **mcp** (`@savvy-web/mcp`) — the spawnable `savvy-mcp` server, a tools-only MCP server (ten tools, no resources). See `packages/mcp/CLAUDE.md`.
- **silk** (`@savvy-web/silk`) — the single install-target of config-integration shims + Biome asset. See `packages/silk/CLAUDE.md`.
- **changelog** (`@savvy-web/changelog`) — the standalone changesets changelog generator; the installable identity for silk-effects' `Changesets.changelogFunctions` and the canonical `.changeset/config.json` changelog id. See `packages/changelog/CLAUDE.md`.
- **bundler** (`@savvy-web/bundler`) — the tsdown-based build orchestrator (`defineBuild`/`runBuild`). See `packages/bundler/CLAUDE.md`.
- **tsdown-plugins** (`@savvy-web/tsdown-plugins`) — the interface-only tsdown/rolldown plugin pack the bundler orchestrates. See `packages/tsdown-plugins/CLAUDE.md`.
- **rspress-builder** (`@savvy-web/rspress-builder`) — RSPress plugin builder, a thin sibling to the bundler. See `packages/rspress-builder/CLAUDE.md`.
- **templates** (`@savvy-web/templates`) — pure-function TypeScript project scaffolding. See `packages/templates/CLAUDE.md`.
- **github-action-builder** (`@savvy-web/github-action-builder`) — zero-config rsbuild build tool for Node.js 24 GitHub Actions. See `packages/github-action-builder/CLAUDE.md`.
- **pnpm-plugin-silk** (`@savvy-web/pnpm-plugin-silk`) — the unified pnpm config dependency distributing the `silk`/`silkPeers` catalogs and install-time policy across the ecosystem. See `packages/pnpm-plugin-silk/CLAUDE.md`.

`e2e/*` is a separate harness area of PRIVATE, test-only packages (`@e2e/bundler`, `@e2e/pnpm-plugin-silk`) — distinct from the published `packages/*` — that exercise built `dist/dev` artifacts against isolated fixtures. See `e2e/CLAUDE.md`.

Also in this repo: the `plugins/silk` Claude Code plugin (the repo's only plugin — `plugins/github-actions` was removed; action-engineering now ships via the separate effected plugin), the placeholder docs site (`docs/`), cross-repo planning, and the plugin marketplace entry point (`.claude-plugin/`).

## Tech Stack

- **Runtime:** Node.js 24.11.0+
- **Package Manager:** pnpm 11.5.1 with `@savvy-web/pnpm-plugin-silk` config dependency
- **Build:** Turborepo orchestration; `@savvy-web/bundler` builds all eleven packages (bundler + tsdown-plugins self-host via their escape-hatch `savvy.build.ts`, the other nine via the front door — `build()`/`defineBuild`/`runBuild`; `pnpm-plugin-silk` uses the `build()` entry); build scripts run `node savvy.build.ts` (Node 24+ native type-stripping), except `tsdown-plugins` which bootstraps via `tsx`
- **Effect:** the whole repo is on Effect v4 (`catalog:effect` / `catalog:effectPeers`). Catalogs come from the `@effected/pnpm-plugin-effect` config dependency (`effect`/`effectPeers`; the `effect3` catalogs remain for any consumer still on v3). `effect` core source is vendored at `.repos/effect` (pinned to the catalog tag) — the authority for v4 APIs. It is checked out from `Effect-TS/effect` itself, NOT the archived `effect-smol` repo: v4 development moved back to the main monorepo. `.repos/config.json` is the live record of url/ref/sparse paths. The suite consumes eleven `@effected/*` kit packages from the npm registry (re-derive the list from the manifests, never from memory)
- **Linting:** Biome, markdownlint
- **Testing:** Vitest via `@vitest-agent/plugin`; a test that runs an Effect takes `describe`/`it`/`expect` from `@effect/vitest` (`catalog:effect`), one with no Effect surface stays on plain `vitest`, and `vi` always comes from `"vitest"` (hoisting). Built-artifact e2e harness in `e2e/*`; the silk plugin's hook shell suite (bats + shellcheck) under `plugins/silk/tests`, run by `pnpm test:hooks`
- **Commits:** Conventional commits with DCO signoff via `@savvy-web/commitlint`
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

`npx biome` is a false green: in this repo it resolves to an unrelated npm package at version `0.3.3` that no-ops and exits 0, so `npx biome check --write` reports success while checking nothing. Real Biome prints `Version: 2.5.1`; the impostor prints a bare `0.3.3`. But `npx biome` isn't even the primary hazard: ANY direct Biome invocation — bare, path-prefixed, `pnpm exec biome`, `npx @biomejs/biome`, `sudo biome`, and every other route — does not resolve this repo's config, so it walks straight into `.repos/**` vendored submodules (read-only, git-managed) and can corrupt them. A `plugins/silk` pre-tool-use hook (`biome-direct-deny`) denies every direct route to Biome, keyed on the script name across pnpm/yarn/bun/npm rather than this repo's own package manager. Use the `mcp__plugin_silk_savvy-mcp__biome_check` MCP tool, or one of the three sanctioned Bash scripts at the repo root: `pnpm lint` / `pnpm lint:fix` / `pnpm lint:fix:unsafe` (any of the four package managers). `pnpm lint`/`lint:fix`/`lint:fix:unsafe` can themselves fail transiently with `Failed to resolve the configuration from @savvy-web/silk/biome` while silk's `dist/dev` is mid-rebuild — that is the known rebuild race, not a config error; retry rather than "fixing" the config.

## Install & Build Orchestration

Build runs on install, but NOT from the root. The root `prepare` is `husky` and nothing else — it installs the git hooks. Dev outputs get built because each workspace-dependency package carries its OWN `prepare: turbo run build:dev`, which pnpm runs per package during `pnpm install`. A fresh clone gets a working `savvy` bin on PATH and functional git hooks immediately. `pnpm build` (turbo `build:dev` + `build:prod`) produces the prod outputs.

### Package scripts

Every package built by `@savvy-web/bundler` (or `@savvy-web/rspress-builder`) declares `publishConfig.directory: dist/dev/pkg` and these scripts (`tsdown-plugins` bootstraps with `tsx` rather than `node`):

```json
"build:dev": "node savvy.build.ts --target dev",
"build:prod": "node savvy.build.ts --target prod",
"types:check": "tsc --noEmit"
```

A package ALSO needs `"prepare": "turbo run build:dev"` whenever it is a `workspace:*` dependency of ANY other `package.json` in the repo — root, a sibling package, or an `e2e/*` fixture. Its consumer resolves it through a `link:` into `dist/dev/pkg`, and that link has to resolve at install time. That package's own `prepare` is the ONLY thing that builds it then; nothing upstream does it for them.

Today: `@savvy-web/bundler`, `@savvy-web/changelog`, `@savvy-web/cli`, `@savvy-web/mcp`, `@savvy-web/pnpm-plugin-silk` (consumed by `e2e/pnpm-plugin-silk`), `@savvy-web/silk`, `@savvy-web/silk-effects`, `@savvy-web/tsdown-plugins`. Re-derive the list rather than trusting it: `grep -rl '"@savvy-web/<name>": "workspace:\*"' package.json packages/*/package.json e2e/*/package.json`.

DO NOT delete these. Agents repeatedly remove them as redundant, reasoning that turbo's `dependsOn` already orders the build. It does not: `dependsOn` only orders builds turbo was ALREADY asked to run, has no say over whether a `prepare` fires, and never reaches `pnpm install`'s linking step. A package that builds fine without one is working by accident of orchestration order — absence of breakage is not evidence the script is unnecessary. The failure mode is `Cannot find package '@savvy-web/<name>'` from anything resolving outside the task graph; `@savvy-web/changelog` hit exactly this and broke `changeset version` / `changeset_preview`.

A package no other `package.json` depends on does not need `prepare` (today: `github-action-builder`, `rspress-builder`, `templates`). Add one the moment something depends on it.

The vitest `globalSetup` runs `pnpm turbo run build:dev`, so when a test run needs to rebuild a package its `dist/dev` (and the `node_modules/@savvy-web/*` `link:` symlinks pointing into it) can momentarily appear missing mid-run. This is transient — do not "fix" it; let the run finish, then re-check. The outputs and links are back once the build completes.

Required `pnpm-workspace.yaml` settings: `autoInstallPeers: true`, `verifyDepsBeforeRun: false`. The plugin is pinned in `pnpm-workspace.yaml` WITH its `+sha512-...` integrity hash (turbo/reproducibility need it); `pnpm add --config` omits the hash, so add it by hand. Do NOT add `injectWorkspacePackages` or `syncInjectedDepsAfterScripts`: injection hard-links each package's `dist/dev` at link time, which is absent before the `prepare` build runs, so a frozen install aborts with `ENOENT`. Plain `link:` symlinks (publishConfig `directory: dist/dev/pkg` for the eleven bundler-built packages, + `linkDirectory: true`) tolerate the not-yet-built dir, which the package's own `prepare` build then populates. `@savvy-web/changelog`, `@savvy-web/cli`, `@savvy-web/mcp`, and `@savvy-web/silk` are the four direct root devDependencies, so they link to `dist/dev`. The `savvy` bin resolves at `dist/dev/pkg/bin/savvy.js`, on PATH once `@savvy-web/cli`'s `prepare` has run. `@savvy-web/changelog` must be a root devDependency: the changesets engine resolves the changelog id named in `.changeset/config.json` from the repo root, and without that link it fails with `Cannot find package`.

## Ecosystem Context

This repo is the hub of the Silk Suite ecosystem spanning 33 repositories, organized into 7 layers: Foundation Libraries (Effect-based) → Package Management → Build Systems → Developer Experience → CI/CD Pipeline → AI/Agent Tooling → Documentation & Templates.

Key coordination points:

- `@savvy-web/pnpm-plugin-silk` provides version catalogs consumed by all repos
- The GitHub Actions consume `@effected/github-actions` (and the wider kit) directly; savvy-specific action logic routes through `@savvy-web/silk-effects`. `@savvy-web/github-action-effects` is DELETED (design tree archived under `.claude/design/_archive/`) — treat any reference to it as stale
- `github-readme-private` (`.github-private`) houses org-level reusable workflows

## Conventions

- Source `package.json` `"private": true` is transformed by builders based on `publishConfig.access`.
- Use `catalog:silk` for pinned dependencies, `catalog:silkPeers` for peer dependency ranges.
- Verify any Effect API against the vendored `.repos/effect` source or the installed beta, never v3 memory.
- All Effect code uses class-based `Context.Service` services (each exporting a companion `*Shape` interface), `Schema.Class`/`Schema.TaggedClass`, `Data.TaggedError`.
- README.md is for external users; `.claude/design/` for package architecture docs.
- The non-import invariant: `@savvy-web/cli`, `@savvy-web/silk`, and `@savvy-web/mcp` must NOT import each other — all three depend only on `@savvy-web/silk-effects` within the repo.
- All packages version INDEPENDENTLY — `.changeset/config.json` has no `fixed` or `linked` arrays. silk/cli/mcp/changelog are NOT a fixed group, but silk stays exactly pinned to the other three automatically: silk declares them as source `dependencies` (`workspace:*`), published as EXACT-pinned regular `dependencies`, never promoted to peers (peer publishing made pnpm `autoInstallPeers` propagate their Effect graph into consumers at wrong versions; `@savvy-web/pnpm-plugin-silk` publicly hoists all three so bins stay available). Changesets reads `workspace:*` as the exact current version, so a cli/mcp/changelog release auto-PATCH-bumps silk (`updateInternalDependencies: patch`) and re-pins it. Plain `dependencies` (never source peerDependencies) means silk is NOT force-major-bumped. silk's `versionFiles` glob still bumps the `plugins/*` manifests in lockstep with silk.
- Integration/e2e tests must NOT resolve `catalog:`/`workspace:` against the host workspace — catalog-resolution coverage lives in `e2e/` via subprocess builds against isolated fixtures (`CatalogResolver` reads `process.cwd()`). See `e2e/CLAUDE.md`.
- `@savvy-web/bundler`, `@savvy-web/rspress-builder`, and `@savvy-web/tsdown-plugins` version independently (no longer a linked group); changesets still auto-bumps the bundler when tsdown-plugins changes (dependency relationship).
- `@savvy-web/pnpm-plugin-silk` versions independently and is npm-registry-only (the one package not also on GitHub Packages).

## Dogfooding `@effected`

A dogfood round consumes the `@effected/*` kit (`spencerbeggs/effected`, a sibling checkout at `../../spencerbeggs/effected`) from LOCAL prod artifacts, so kit APIs get shaped against real consumers before release. This section is the durable pattern, not current state.

**Currently UNLINKED:** the github-split wave shipped, so `pnpm-workspace.yaml` carries no `@effected` `file:` overrides and every manifest resolves from the registry. Check for that `overrides:` block before assuming a round is open — no block, normal push/PR rules.

**Authorities.** For `effect` core itself: the vendored source at `.repos/effect` (pinned to the catalog tag). For `@effected/*`: the kit source at `../../spencerbeggs/effected/packages/<name>/src` and the installed `.d.ts` under `node_modules/@effected/<name>/` — verify signatures there, never from summaries relayed between sessions.

**pnpm linking.** `pnpm-workspace.yaml` carries an `overrides:` entry per consumed kit package: `"@effected/<name>": "file:../../spencerbeggs/effected/packages/<name>/dist/prod/npm/pkg"` (the manifest lives under `pkg/`, not `npm/`). Package manifests keep ordinary registry semver ranges — the overrides do the linking, and removing them relinks to the registry. Keep the override list covering the FULL transitive `@effected` closure (re-derive from the lockfile, not memory).

**Inter-agent mailbox.** Cross-repo communication lives at `.claude/dogfood/<sending-id>/` in the RECEIVING repo, where `<sending-id>` is the SENDER's root `package.json` name — gitignored on both sides, never in design docs. This repo's id is `savvy-web-systems`; the kit repo's is `effected`. So: outbound requests go to `../../spencerbeggs/effected/.claude/dogfood/savvy-web-systems/` (e.g. `systems-dogfood-feedback.md`), and the kit session's return handoffs arrive here in `.claude/dogfood/effected/`. Reports carry `file:line` references so the other side reads real call sites, and each keeps an item-status table current.

**The loop.** (1) Migrate a piece here. (2) Gather findings — hand-rolled capability the kit should own, API friction, bugs — each with `file:line` references into this repo. (3) Write them as requests into the kit repo's mailbox (above). (4) An agent session in the effected repo implements on a branch there and rebuilds prod artifacts in place. (5) On the return handoff (its mailbox file here), refresh: `pnpm clean --lockfile && pnpm install --ignore-scripts`, then `pnpm rebuild esbuild` — `--ignore-scripts` skips native postinstalls, so esbuild's platform binary is missing and vite/vitest die without that rebuild. (6) Adopt the new surfaces, run the full gates (types:check, build:dev/prod, package tests), and feed the next round of findings back into the report.

**Discipline.** While `file:` overrides are active this branch does NOT push or open PRs — the paths only exist on this machine and the loop isn't done until the kit provides what we need. The exit is: effected cuts a live release, the `overrides:` block is deleted (unlink), `pnpm clean --lockfile && pnpm install` against the registry, full verification, and only then the finalize workflow (docs, changesets, squash, PR).

## Design Documentation

Design docs live in `.claude/design/` (tracked). Per-package design pointers live in each `packages/<pkg>/CLAUDE.md`. These pointers cover topics with no package subtree to auto-load from:

**`plugins/silk` — the merged Claude Code plugin:**
→ `@./.claude/design/silk/plugin.md`
Load when working on `plugins/silk` (skills, agents, monitors, hooks, MCP wiring).

**Suite-wide test conventions (`@effect/vitest`):**
→ `@./.claude/design/testing/effect-vitest.md`
Load before writing or converting any test that runs an Effect. Covers `it.effect` vs `it.live` vs suite-boundary `layer(...)` (which memoizes, bleeding test-double state — per-test `Effect.provide` is the default), `Effect.flip` for typed-failure assertions, and the `TestClock`/`TestConsole` swaps that silently change what a test observes.
