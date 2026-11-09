---
type: Convention
status: draft
title: Resolve workspace packages from source; never re-add install-time builds
description: "Keep workspace links resolving to src/ through exports and tsx: never add prepare, build:dev, a dist/dev link, publishConfig.directory or injectWorkspacePackages, and keep the tsx self-registration in every bin."
stale_after: 2027-05-09T00:00:00Z
tags: [build, dx]
generated:
  by: okfit/claude-code
  at: 2026-11-09T20:39:04Z
sources:
  - id: root-manifest
    resource: ../../package.json
  - id: workspace-config
    resource: ../../pnpm-workspace.yaml
  - id: cli-bin
    resource: ../../packages/cli/src/bin.ts
  - id: vitest-setup
    resource: ../../vitest.setup.ts
integrity:
  generated:
    body: b27296a63c1df322
---

# Resolve workspace packages from source; never re-add install-time builds

Point every package's `exports` and `bin` at `src/` and let a `workspace:` dependency resolve there. Build with the single `build` script, `effected package build`, configured in the package's `effected.toml`. Why the repository works this way is [kit-package-build](../decisions/kit-package-build.md).

## Do not reintroduce the old link model

Do not add a `prepare: turbo run build:dev` script, a `build:dev` or `build:prod` script, `publishConfig.directory` or `publishConfig.linkDirectory` to any package. Nothing in the repository needs a build before it runs: a pnpm script loads sibling TypeScript through `nodeOptions: --import=tsx`, and the bins register tsx themselves.[^workspace-config] Do NOT add `injectWorkspacePackages` or `syncInjectedDepsAfterScripts` to `pnpm-workspace.yaml` either: injection copies or hard-links the package instead of linking its source.

## Keep the bins self-registering

Keep the guarded block at the top of every bin that a process may run without pnpm (cli and mcp `src/bin.ts`, silk `src/bin/savvy.ts` and `src/bin/savvy-mcp.ts`): when `import.meta.url` ends in `.ts`, import `tsx/esm/api` and call `register()` before the first import that resolves a sibling's source. Keep the specifier computed (`["tsx", "esm", "api"].join("/")`) so the bundler cannot inline it, and keep the real import dynamic so it runs after registration. tsx is a root devDependency only; the built `.js` bin never takes the branch.[^cli-bin]

## Blank NODE_OPTIONS for children that run outside the workspace

The workspace's `nodeOptions: --import=tsx` reaches every process pnpm starts, children included, and a bare `tsx` specifier resolves against the child's working directory. Any pnpm script whose children run from outside the workspace — a temp directory, a scratch consumer — must blank it, as both `test:hooks` scripts do with `NODE_OPTIONS= bash …`: the plugin's monitor bats suites run node from a temp cwd where `tsx` cannot resolve. A child that does need tsx gets it by absolute file URL instead (see below).[^root-manifest]

## Root devDependency posture

Keep `@savvy-web/changelog` a root devDependency — the changesets engine resolves the changelog id named in `.changeset/config.json` from the repo root. The root's only other workspace devDependency is `@savvy-web/silk`, the carrier of the `savvy`/`savvy-mcp` bins (see [carrier-pattern-package-graph](../decisions/carrier-pattern-package-graph.md)). Do not add `@savvy-web/cli` or `@savvy-web/mcp` to the root.[^root-manifest]

## Testing built artifacts

Build only what a test executes. The vitest global setup builds `--filter '@savvy-web/silk...' --filter @savvy-web/pnpm-plugin-silk`; a suite that spawns a built bin reads `dist/prod/npm/pkg/bin/*.js` and passes `NODE_OPTIONS=--import=<absolute tsx file URL>`, because a built bin inside the workspace still imports its siblings from source. Widen the filter only when a new suite executes a package outside it, as pnpm-plugin-silk's pnpmfile contract did.[^vitest-setup]

[^root-manifest]: `../../package.json` — `prepare: husky` and the `@savvy-web/changelog`, `@savvy-web/silk` and `tsx` devDependencies
[^workspace-config]: `../../pnpm-workspace.yaml` — `nodeOptions: --import=tsx`
[^cli-bin]: `../../packages/cli/src/bin.ts` — the guarded tsx registration
[^vitest-setup]: `../../vitest.setup.ts` — the silk-closure plus pnpm-plugin-silk build filter
