# Silk Suite Systems

Coordination hub for the Silk Suite open-source ecosystem by Savvy Web Systems.

## Packages

Each package has its own `CLAUDE.md` (auto-loaded when you work in its subtree) and a design doc under `.claude/design/<pkg>/`.

- **silk-effects** (`@savvy-web/silk-effects`) — shared Effect library and dev-tooling business-logic core (`Changesets`/`Commitlint`/`Lint`/`Turbo`). See `packages/silk-effects/CLAUDE.md`.
- **cli** (`@savvy-web/cli`) — the `savvy` binary (`init`/`check`/`commit`/`changeset`/`lint`/`clean`). See `packages/cli/CLAUDE.md`.
- **mcp** (`@savvy-web/mcp`) — the spawnable `savvy-mcp` server, a tools-only MCP server (eight tools, no resources). See `packages/mcp/CLAUDE.md`.
- **silk** (`@savvy-web/silk`) — the single install-target of config-integration shims + Biome asset. See `packages/silk/CLAUDE.md`.
- **changelog** (`@savvy-web/changelog`) — the standalone changesets changelog generator; the installable identity for silk-effects' `Changesets.changelogFunctions` and the canonical `.changeset/config.json` changelog id. See `packages/changelog/CLAUDE.md`.
- **bundler** (`@savvy-web/bundler`) — the tsdown-based build orchestrator (`defineBuild`/`runBuild`). See `packages/bundler/CLAUDE.md`.
- **tsdown-plugins** (`@savvy-web/tsdown-plugins`) — the interface-only tsdown/rolldown plugin pack the bundler orchestrates. See `packages/tsdown-plugins/CLAUDE.md`.
- **rspress-builder** (`@savvy-web/rspress-builder`) — RSPress plugin builder, a thin sibling to the bundler. See `packages/rspress-builder/CLAUDE.md`.
- **templates** (`@savvy-web/templates`) — pure-function TypeScript project scaffolding. See `packages/templates/CLAUDE.md`.
- **github-action-builder** (`@savvy-web/github-action-builder`) — zero-config rsbuild build tool for Node.js 24 GitHub Actions. See `packages/github-action-builder/CLAUDE.md`.
- **github-action-effects** (`@savvy-web/github-action-effects`) — Effect services replacing `@actions/*`. See `packages/github-action-effects/CLAUDE.md`.
- **pnpm-plugin-silk** (`@savvy-web/pnpm-plugin-silk`) — the unified pnpm config dependency distributing the `silk`/`silkPeers` catalogs and install-time policy across the ecosystem. See `packages/pnpm-plugin-silk/CLAUDE.md`.

`e2e/*` is a separate harness area of PRIVATE, test-only packages (`@e2e/bundler`, `@e2e/pnpm-plugin-silk`) — distinct from the published `packages/*` — that exercise built `dist/dev` artifacts against isolated fixtures. See `e2e/CLAUDE.md`.

Also in this repo: the Claude Code plugins (`plugins/silk`, `plugins/github-actions`), the placeholder docs site (`docs/`), cross-repo planning, and the plugin marketplace entry point (`.claude-plugin/`).

## Tech Stack

- **Runtime:** Node.js 24.11.0+
- **Package Manager:** pnpm 11.5.1 with `@savvy-web/pnpm-plugin-silk` config dependency
- **Build:** Turborepo orchestration; `@savvy-web/bundler` builds all twelve packages (bundler + tsdown-plugins self-host via their escape-hatch `savvy.build.ts`, the other ten via the front door — `build()`/`defineBuild`/`runBuild`; `pnpm-plugin-silk` uses the `build()` entry); build scripts run `node savvy.build.ts` (Node 24+ native type-stripping), except `tsdown-plugins` which bootstraps via `tsx`
- **Linting:** Biome, markdownlint
- **Testing:** Vitest via `@vitest-agent/plugin`; built-artifact e2e harness in `e2e/*`
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

## Install & Build Orchestration

Build runs on install. A single root `prepare: husky && turbo run build:dev` builds the dev outputs during `pnpm install` (husky runs first so git hooks install even if the build is slow). There are no per-package `prepare` scripts. A fresh clone gets a working `savvy` bin on PATH and functional git hooks immediately. `pnpm build` (turbo `build:dev` + `build:prod`) produces the prod outputs.

The vitest `globalSetup` runs `pnpm turbo run build:dev`, so when a test run needs to rebuild a package its `dist/dev` (and the `node_modules/@savvy-web/*` `link:` symlinks pointing into it) can momentarily appear missing mid-run. This is transient — do not "fix" it; let the run finish, then re-check. The outputs and links are back once the build completes.

Required `pnpm-workspace.yaml` settings: `autoInstallPeers: true`, `verifyDepsBeforeRun: false`. The plugin is pinned in `pnpm-workspace.yaml` WITH its `+sha512-...` integrity hash (turbo/reproducibility need it); `pnpm add --config` omits the hash, so add it by hand. Do NOT add `injectWorkspacePackages` or `syncInjectedDepsAfterScripts`: injection hard-links each package's `dist/dev` at link time, which is absent before the `prepare` build runs, so a frozen install aborts with `ENOENT`. Plain `link:` symlinks (publishConfig `directory: dist/dev/pkg` for the twelve bundler-built packages, + `linkDirectory: true`) tolerate the not-yet-built dir, which the `prepare` build then populates. `@savvy-web/cli` and `@savvy-web/mcp` are direct root devDependencies so they link to `dist/dev`. The `savvy` bin resolves at `dist/dev/pkg/bin/savvy.js`, on PATH after the `prepare` build.

## Ecosystem Context

This repo is the hub of the Silk Suite ecosystem spanning 33 repositories, organized into 7 layers: Foundation Libraries (Effect-based) → Package Management → Build Systems → Developer Experience → CI/CD Pipeline → AI/Agent Tooling → Documentation & Templates.

Key coordination points:

- `@savvy-web/pnpm-plugin-silk` provides version catalogs consumed by all repos
- `@savvy-web/github-action-effects` provides Effect services for all GitHub Actions
- `github-readme-private` (`.github-private`) houses org-level reusable workflows

## Conventions

- Source `package.json` `"private": true` is transformed by builders based on `publishConfig.access`.
- Use `catalog:silk` for pinned dependencies, `catalog:silkPeers` for peer dependency ranges.
- All Effect code uses class-based `Context.Tag`, `Schema.Class`/`Schema.TaggedClass`, `Data.TaggedError`.
- README.md is for external users; `.claude/design/` for package architecture docs.
- The non-import invariant: `@savvy-web/cli`, `@savvy-web/silk`, and `@savvy-web/mcp` must NOT import each other — all three depend only on `@savvy-web/silk-effects` within the repo.
- All packages version INDEPENDENTLY — `.changeset/config.json` has no `fixed` or `linked` arrays. silk/cli/mcp/changelog are NOT a fixed group, but silk stays exactly pinned to cli/mcp/changelog automatically: silk declares `@savvy-web/cli`/`@savvy-web/mcp`/`@savvy-web/changelog` as source `dependencies` (`workspace:*`), published as EXACT-pinned regular `dependencies` — the build transform no longer promotes them to peers (peer publishing made pnpm `autoInstallPeers` propagate their Effect graph into consumers at wrong versions; `@savvy-web/pnpm-plugin-silk` publicly hoists all three so bins stay available). Changesets reads `workspace:*` as the exact current version, so a cli/mcp/changelog release auto-PATCH-bumps silk (`updateInternalDependencies: patch`) and re-pins the exact version. Because they are plain `dependencies` (never source peerDependencies), silk is NOT force-major-bumped. silk's `versionFiles` glob still bumps the `plugins/*` manifests in lockstep with silk.
- Integration/e2e tests must NOT resolve `catalog:`/`workspace:` against the host workspace — catalog-resolution coverage lives in `e2e/` via subprocess builds against isolated fixtures (`CatalogResolver` reads `process.cwd()`). See `e2e/CLAUDE.md`.
- `@savvy-web/bundler`, `@savvy-web/rspress-builder`, and `@savvy-web/tsdown-plugins` version independently (no longer a linked group); changesets still auto-bumps the bundler when tsdown-plugins changes (dependency relationship). Both bundler and tsdown-plugins self-host while the other ten packages build via the bundler front door.
- `@savvy-web/pnpm-plugin-silk` versions independently and is npm-registry-only (the one package not also on GitHub Packages).

## Design Documentation

Design docs live in `.claude/design/` (tracked). Per-package design pointers live in each `packages/<pkg>/CLAUDE.md`. These pointers cover topics with no package subtree to auto-load from:

**`plugins/silk` — the merged Claude Code plugin:**
→ `@./.claude/design/silk/plugin.md`
Load when working on `plugins/silk` (skills, agents, monitors, hooks, MCP wiring).
