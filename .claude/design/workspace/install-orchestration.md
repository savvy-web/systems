---
status: current
module: workspace
category: architecture
created: 2026-09-03
updated: 2026-09-03
last-synced: 2026-09-03
completeness: 90
related:
  - ../bundler/self-hosting.md
  - ../bundler/architecture.md
  - ../e2e/architecture.md
  - ../changelog/architecture.md
dependencies: []
---

# Install and build orchestration

How a fresh `pnpm install` of this monorepo ends up with working `dist/dev` outputs, a `savvy` bin on PATH and
functional git hooks — and which manifest settings make that hold. The per-package build stack itself is documented
in [bundler self-hosting](../bundler/self-hosting.md); this doc covers the workspace wiring around it.

## Table of contents

- [Overview](#overview)
- [Current State](#current-state)
- [Who builds what, and when](#who-builds-what-and-when)
- [The package-scripts contract](#the-package-scripts-contract)
- [The `prepare` rule](#the-prepare-rule)
- [Workspace linking settings](#workspace-linking-settings)
- [Transient states that look like breakage](#transient-states-that-look-like-breakage)
- [Rationale](#rationale)

## Overview

Build runs on install, but NOT from the root. The root `prepare` is `husky` and nothing else — it installs the git
hooks. Dev outputs get built because each workspace-dependency package carries its OWN `prepare: turbo run build:dev`,
which pnpm runs per package during `pnpm install`. Consumers resolve every in-repo package through a `link:` symlink
into that package's `dist/dev/pkg`, so the link tolerates a not-yet-built directory and the package's own `prepare`
populates it. `pnpm build` (turbo `build:dev` + `build:prod`) produces the prod outputs.

## Current State

Implemented and load-bearing. Eight packages carry the `prepare` script because something depends on them; re-derive
the set with the grep in [The `prepare` rule](#the-prepare-rule) rather than trusting any list written down here.

## Who builds what, and when

- **Root `prepare` = `husky`.** It never invokes turbo. Nothing at the root builds a package.
- **Per-package `prepare` = `turbo run build:dev`.** pnpm runs it for each workspace package during install, so each
  package builds itself. Turbo's `dependsOn` then orders the upstream builds THAT invocation needs — `tsdown-plugins`
  before `bundler` before everything else (the bootstrap ladder in [self-hosting](../bundler/self-hosting.md)).
- **`pnpm build`** runs `build:dev` then `build:prod` across the graph for release artifacts.
- **The vitest `globalSetup`** (`vitest.setup.ts`) runs `pnpm turbo run build:dev` before a test run, so tests always
  exercise current `dist/dev` outputs.

## The package-scripts contract

Every package built by `@savvy-web/bundler` (or `@savvy-web/rspress-builder`) declares
`publishConfig.directory: dist/dev/pkg`, `publishConfig.linkDirectory: true`, and these scripts:

```json
"build:dev": "node savvy.build.ts --target dev",
"build:prod": "node savvy.build.ts --target prod",
"types:check": "tsc --noEmit"
```

Build scripts run `node savvy.build.ts` (Node 24+ native type-stripping). The one exception is `tsdown-plugins`, which
bootstraps via `tsx` because its escape-hatch build imports its own un-built `./src`.

## The `prepare` rule

A package ALSO needs `"prepare": "turbo run build:dev"` whenever it is a `workspace:*` dependency of ANY other
`package.json` in the repo — root, a sibling package, or an `e2e/*` fixture. Its consumer resolves it through a
`link:` into `dist/dev/pkg`, and that link has to resolve at install time. That package's own `prepare` is the ONLY
thing that builds it then; nothing upstream does it for them.

Re-derive the set:

```bash
grep -rl '"@savvy-web/<name>": "workspace:\*"' package.json packages/*/package.json e2e/*/package.json
```

Today that is `bundler`, `changelog`, `cli`, `mcp`, `pnpm-plugin-silk` (consumed by `e2e/pnpm-plugin-silk`), `silk`,
`silk-effects` and `tsdown-plugins`. `rspress-builder` and `templates` have no in-repo consumer and carry no `prepare`;
add one the moment something depends on them.

**DO NOT delete these scripts.** Agents repeatedly remove them as redundant, reasoning that turbo's `dependsOn` already
orders the build. It does not: `dependsOn` only orders builds turbo was ALREADY asked to run, has no say over whether a
`prepare` fires, and never reaches `pnpm install`'s linking step. A package that builds fine without one is working by
accident of orchestration order — absence of breakage is not evidence the script is unnecessary. The failure mode is
`Cannot find package '@savvy-web/<name>'` from anything resolving outside the task graph. `@savvy-web/changelog` hit
exactly this: the changesets engine resolves the changelog id named in `.changeset/config.json` from the repo root, and
without a built link `changeset version` and the `changeset_preview` MCP tool both died with `Cannot find package`.

## Workspace linking settings

Required `pnpm-workspace.yaml` settings:

- `autoInstallPeers: true` and `verifyDepsBeforeRun: false`.
- `@savvy-web/pnpm-plugin-silk` pinned as a config dependency WITH its `+sha512-...` integrity hash (turbo and
  reproducibility need it). `pnpm add --config` omits the hash, so add it by hand.
- Do NOT add `injectWorkspacePackages` or `syncInjectedDepsAfterScripts`. Injection hard-links each package's
  `dist/dev` at link time, which is absent before the `prepare` build runs, so a frozen install aborts with `ENOENT`.
  Plain `link:` symlinks (from `publishConfig.directory` + `linkDirectory: true`) tolerate the not-yet-built directory.

Root devDependencies: `@savvy-web/changelog`, `@savvy-web/cli`, `@savvy-web/mcp` and `@savvy-web/silk` are the four
direct root devDependencies, so they link to `dist/dev`. The `savvy` bin resolves at `dist/dev/pkg/bin/savvy.js`, on
PATH once `@savvy-web/cli`'s `prepare` has run. `@savvy-web/changelog` MUST stay a root devDependency for the
changesets-engine resolution described above.

## Transient states that look like breakage

When the vitest `globalSetup` (or any turbo run) rebuilds a package, its `dist/dev` — and the
`node_modules/@savvy-web/*` `link:` symlinks pointing into it — can momentarily appear missing mid-run. This is
transient; do not "fix" it. Let the run finish, then re-check: the outputs and links are back once the build completes.
The same race produces `Failed to resolve the configuration from @savvy-web/silk/biome` from `pnpm lint` while silk's
`dist/dev` is mid-rebuild — retry rather than editing the Biome config.

## Rationale

Building per package at `prepare` time is the only hook that fires inside `pnpm install`'s lifecycle for every clone
and every CI job, without asking the root to know the dependency graph. `link:` symlinks rather than injection keep a
frozen install from failing on directories that only exist after that same install's scripts run. The cost is the
redundancy-shaped `prepare` scripts, which is why the rule is written down with its failure mode: the scripts look
removable precisely because the orchestration usually hides their absence.
