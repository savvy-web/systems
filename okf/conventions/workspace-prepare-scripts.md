---
type: Convention
title: Keep prepare:turbo run build:dev on every workspace:* dependency
description: "Any package that is a workspace:* dependency of any package.json (root, sibling, or e2e/* fixture) must carry its own `prepare: turbo run build:dev` script; never delete it as redundant, and never add injectWorkspacePackages to route around it."
stale_after: 2027-03-12T00:00:00-04:00
tags: [build]
sources:
  - id: install-orchestration
    resource: ../../package.json
  - id: claude-md
    resource: ../../CLAUDE.md
generated:
  by: okfit/claude-code
  at: 2026-09-13T01:18:00Z
  body_sha256: 0cf7631787be9c5256777f1a79868b5ba3689e2e42caae4640b4e25e294df3eb
---

# Keep prepare:turbo run build:dev on every workspace:* dependency

Build a package via its own `prepare` script whenever it is a `workspace:*` dependency of ANY `package.json` in the repo — root, a sibling package, or an `e2e/*` fixture. pnpm runs `prepare` for each workspace package during `pnpm install`; a consumer resolves the dependency through a `link:` symlink into `dist/dev/pkg`, and that link has to resolve at install time. That package's own `prepare` is the ONLY thing that builds it before consumers need it — nothing upstream does it for them. See [per-package-prepare-builds](../decisions/per-package-prepare-builds.md) for why this shape was chosen over a root-level build.[^install-orchestration]

Re-derive the current set rather than trusting a list written down anywhere:

```bash
grep -rl '"@savvy-web/<name>": "workspace:\*"' package.json packages/*/package.json e2e/*/package.json
```

## DO NOT delete these scripts

Do not remove a package's `prepare` script as redundant on the reasoning that turbo's `dependsOn` already orders the build. It does not: `dependsOn` only orders builds turbo was ALREADY asked to run, has no say over whether a `prepare` fires, and never reaches `pnpm install`'s linking step. A package that builds fine without its own `prepare` is working by accident of orchestration order — absence of breakage is not evidence the script is unnecessary. The failure mode is `Cannot find package '@savvy-web/<name>'` from anything resolving outside the task graph. `@savvy-web/changelog` hit exactly this: the changesets engine resolves the changelog id named in `.changeset/config.json` from the repo root, and without a built link, `changeset version` and the `changeset_preview` MCP tool both died with `Cannot find package`.[^install-orchestration]

## Root devDependency posture

`@savvy-web/changelog` must stay a root devDependency — the changesets engine resolves the changelog id from the repo root, so a missing root link breaks release tooling directly. The root's only OTHER workspace devDependency is `@savvy-web/silk`, which carries the `savvy`/`savvy-mcp` bins over the front ends' `./main` contract (see [carrier-pattern-package-graph](../decisions/carrier-pattern-package-graph.md)). `@savvy-web/cli` and `@savvy-web/mcp` are NOT root devDependencies — do not re-add them.[^claude-md]

## Never add injectWorkspacePackages

Do NOT add `injectWorkspacePackages` or `syncInjectedDepsAfterScripts` to `pnpm-workspace.yaml`. Injection hard-links each package's `dist/dev` at link time, before that package's own `prepare` has built it, so a frozen install aborts with `ENOENT`. Plain `link:` symlinks (from `publishConfig.directory` + `linkDirectory: true`) tolerate the not-yet-built directory because the same `prepare` build populates it afterward.[^install-orchestration]

## Transient states that look like breakage

When the vitest `globalSetup` (or any turbo run) rebuilds a package, its `dist/dev` — and the `node_modules/@savvy-web/*` `link:` symlinks pointing into it — can momentarily appear missing mid-run. This is transient; do not "fix" it. Let the run finish, then re-check. The same race produces `Failed to resolve the configuration from @savvy-web/silk/biome` from `pnpm lint` while silk's `dist/dev` is mid-rebuild — retry rather than editing the Biome config.[^install-orchestration]

[^install-orchestration]: `../../package.json` — root `prepare: husky` plus the `@savvy-web/changelog`/`@savvy-web/silk` workspace devDependencies; the `injectWorkspacePackages` guard is `../../pnpm-workspace.yaml`
[^claude-md]: [CLAUDE.md](../../CLAUDE.md), "Install & Build Orchestration"
