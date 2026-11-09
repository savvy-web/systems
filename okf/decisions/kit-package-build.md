---
type: Decision
title: Build every package with the kit's effected package build, linked to source
description: "Every package builds with `effected package build` from @effected/plugin; workspace links resolve to src/ through exports and tsx, nothing builds on install, and the in-repo bundler, tsdown-plugins, rspress-builder and github-action-builder are deleted with no final release."
status: draft
tags: [build, architecture, deps]
supersedes: per-package-prepare-builds.md
generated:
  by: okfit/claude-code
  at: 2026-11-09T19:56:29Z
sources:
  - id: root-manifest
    resource: ../../package.json
  - id: turbo-config
    resource: ../../turbo.json
  - id: workspace-config
    resource: ../../pnpm-workspace.yaml
  - id: vitest-setup
    resource: ../../vitest.setup.ts
  - id: silk-bin
    resource: ../../packages/silk/src/bin/savvy.ts
  - id: kit-ledger-package-build
    resource: https://github.com/spencerbeggs/effected/blob/main/plugin/skills/effected-renovate/references/ledger/0001-effected-package-build.md
  - id: kit-ledger-runtime-subdir
    resource: https://github.com/spencerbeggs/effected/blob/main/plugin/skills/effected-renovate/references/ledger/0038-adopt-runtime-subdir-override.md
integrity:
  generated:
    body: 9adae80882b1a02d
---

# Build every package with the kit's effected package build, linked to source

## Context

The repository used to carry its own build toolchain: `@savvy-web/bundler` (tsdown orchestration), `@savvy-web/tsdown-plugins`, `@savvy-web/rspress-builder` and `@savvy-web/github-action-builder`. Every package that another manifest depended on through `workspace:` built a `dist/dev` tree in its own `prepare` script, and consumers linked into that tree ([per-package-prepare-builds](per-package-prepare-builds.md)). The `@effected/plugin` package from the kit now ships the same capability — `effected package build` for libraries and `effected action build` for GitHub Actions — configured per package by an optional `effected.toml`.[^kit-ledger-package-build]

## Decision

- Every package's `build` script is `effected package build`. Per-package settings live in `effected.toml` under `[package.build]`, `[package.build.meta]`, `[package.build.meta.tsdoc]` and `[package.bundle]`. The build writes `dist/prod/<group>/pkg` (group `npm`), `dist/prod/targets.json` and `dist/prod/issues.json`. tsconfigs extend `@effected/plugin/tsconfig/ecma.json`, and env declarations reference `@effected/plugin/env`.
- Turborepo runs one `build` task, which depends on `types:check`; `types:check` depends on `^types:check`. Root `pnpm build` is `turbo run build`.[^turbo-config]
- Nothing builds on install. No package carries `prepare`, `build:dev`, `build:prod`, `publishConfig.directory` or `publishConfig.linkDirectory`, and no `dist/dev` tree exists. A workspace link resolves through the package's `exports` to its `src/` TypeScript.
- pnpm scripts load that TypeScript through `nodeOptions: --import=tsx` in `pnpm-workspace.yaml`, with `tsx` a root devDependency from `catalog:effected:build`.[^workspace-config] The `savvy` and `savvy-mcp` bins register tsx themselves when they run as `.ts` (guarded by `import.meta.url.endsWith(".ts")`), so a git hook, the plugin's MCP launcher or a bare shell runs them from source without nodeOptions; a built `.js` bin never takes that branch.[^silk-bin]
- The vitest global setup builds only `@savvy-web/silk...` and `@savvy-web/pnpm-plugin-silk` — the packages whose built artifacts the carrier-bin, cli/mcp bin, packed-install and pnpmfile-contract suites execute.[^vitest-setup]
- `@savvy-web/bundler`, `@savvy-web/tsdown-plugins`, `@savvy-web/rspress-builder` and `@savvy-web/github-action-builder` are deleted from the repository with no final release; their published versions stay on the registry and consumers migrate to `@effected/plugin`. rspress-builder's `runtime: true` maps to a `[[package.build.overrides]]` block with `outSubdir = "runtime"`.[^kit-ledger-runtime-subdir]
- Silk's own `build` catalog is trimmed to the members the kit does not supply (`@tsdown/css`, `@types/bun`); the rest of the build chain comes from `catalog:effected:build`, supplied by `@effected/pnpm-plugin-effected` (see [silk-catalogs](../interfaces/silk-catalogs.md)).

## Alternatives rejected

- **Keep maintaining the in-repo bundler family.** Rejected: it duplicated a capability the kit maintains and dogfoods across its own packages, and kept four packages, their tests and their release surface in this repository for no Silk-specific gain.
- **Keep the per-package `prepare` + `dist/dev` link model on top of the kit build.** Rejected: linking to source removes the install-time build entirely, which removes the `Cannot find package '@savvy-web/<name>'` failure mode that model existed to prevent; a build is needed only for tests that execute a built artifact.
- **Cut a final deprecation release of the deleted packages.** Rejected: the published versions keep working where installed, and a release from a package the repository no longer builds would need the deleted toolchain to produce it.

## Consequences

- The ongoing rule for contributors is [workspace-source-links](../conventions/workspace-source-links.md).
- `@savvy-web/changelog` must still be a root devDependency, because the changesets engine resolves the changelog id from the repo root; it now resolves to source rather than a built link.[^root-manifest]
- A built bin inside the workspace still imports its siblings from source, so tests that spawn `dist/prod/npm/pkg/bin/*.js` pass `NODE_OPTIONS=--import=<absolute tsx file URL>`; a bare `--import=tsx` would resolve against the child's working directory.
- `silk-effects`' `TurboInspector` and mcp's `turbo_inspect` default to the `build` task, and `packages/silk/layers.json` lists only `templates` and `pnpm-plugin-silk` as tooling.

[^root-manifest]: `../../package.json` — root `prepare: husky`, `build: turbo run build`, and the `@savvy-web/changelog`, `@savvy-web/silk` and `tsx` devDependencies
[^turbo-config]: `../../turbo.json` — the single `build` task and `types:check` on `^types:check`
[^workspace-config]: `../../pnpm-workspace.yaml` — `nodeOptions: --import=tsx`
[^vitest-setup]: `../../vitest.setup.ts` — `turbo run build --filter '@savvy-web/silk...' --filter @savvy-web/pnpm-plugin-silk`
[^silk-bin]: `../../packages/silk/src/bin/savvy.ts` — the guarded tsx self-registration, mirrored in `savvy-mcp.ts` and the cli and mcp `src/bin.ts`
[^kit-ledger-package-build]: <https://github.com/spencerbeggs/effected/blob/main/plugin/skills/effected-renovate/references/ledger/0001-effected-package-build.md>
[^kit-ledger-runtime-subdir]: <https://github.com/spencerbeggs/effected/blob/main/plugin/skills/effected-renovate/references/ledger/0038-adopt-runtime-subdir-override.md>
