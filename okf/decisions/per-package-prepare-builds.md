---
type: Decision
title: Build each workspace-dependency package via its own prepare script
description: "Every package another manifest depends on as workspace:* carries its own prepare script (turbo run build:dev) instead of relying on a root prepare or turbo's dependsOn."
status: draft
tags: [build, architecture]
generated:
  by: okfit/claude-code
  at: 2026-09-13T01:05:33Z
  body_sha256: 9f3b2d4e8b30017686de56b5aa58601c2689c3285489be19ccb2ee3232a04fc1
sources:
  - id: install-orchestration
    resource: ../../package.json
---

# Build each workspace-dependency package via its own prepare script

## Context

A fresh `pnpm install` of this monorepo must end with working `dist/dev`
outputs for every in-repo package, a `savvy` bin on `PATH`, and functional
git hooks — for every clone and every CI job, without the root needing to
know the dependency graph. Every workspace-dependency package resolves
through a `link:` symlink (`publishConfig.directory: dist/dev/pkg`,
`publishConfig.linkDirectory: true`) into that package's own `dist/dev`,
which does not exist until something builds it.

## Decision

Every package that is a `workspace:*` dependency of ANY other
`package.json` in the repo — root, a sibling package, or an `e2e/*`
fixture — carries its own `"prepare": "turbo run build:dev"` script. pnpm
runs each package's `prepare` for that package during `pnpm install`, so
each package builds itself; turbo's `dependsOn` then orders only the
upstream builds that invocation needs (the bootstrap ladder — e.g.
`tsdown-plugins` before `bundler`).

The root `prepare` is `husky` and nothing else — it installs git hooks and
never invokes turbo. Nothing at the root builds a package. `pnpm build`
(`build:dev` + `build:prod` across the graph) produces release artifacts
separately.

Re-derive the set of packages that need `prepare` with:

```bash
grep -rl '"@savvy-web/<name>": "workspace:\*"' package.json packages/*/package.json e2e/*/package.json
```

rather than trusting any list written down in a doc.

The imperative rule for contributors — when to add or keep this script —
is [conventions/workspace-prepare-scripts.md](../conventions/workspace-prepare-scripts.md).

## Alternatives rejected

- **A single root `prepare` that builds every package.** Rejected: it
  would require the root to know the whole dependency graph and re-derive
  it on every package addition, centralizing knowledge that is naturally
  owned by each consuming manifest's own `workspace:*` edge.
- **Relying on turbo's `dependsOn` alone.** Rejected: `dependsOn` only
  orders builds turbo was ALREADY asked to run — it has no say over
  whether a `prepare` fires at all, and never reaches `pnpm install`'s
  linking step. A package that builds fine without its own `prepare` is
  working by accident of some other task's orchestration order; absence
  of breakage is not evidence the script is unnecessary. The concrete
  failure mode is `Cannot find package '@savvy-web/<name>'` from anything
  resolving outside the task graph — `@savvy-web/changelog` hit exactly
  this when the changesets engine (which resolves the changelog id from
  the repo root, outside any turbo invocation) died with
  `Cannot find package` because no built link existed yet.
- **`injectWorkspacePackages` / `syncInjectedDepsAfterScripts` in
  `pnpm-workspace.yaml`.** Rejected: injection hard-links each package's
  `dist/dev` at link time, which is absent before that package's own
  `prepare` build has run, so a frozen install aborts with `ENOENT`. Plain
  `link:` symlinks (from `publishConfig.directory` + `linkDirectory:
  true`) tolerate the not-yet-built directory instead, because a symlink
  resolves lazily.

## Consequences

- Nine packages (today: `bundler`, `changelog`, `cli`, `mcp`,
  `pnpm-plugin-silk`, `silk`, `silk-core`, `silk-effects`,
  `tsdown-plugins`) carry the `prepare` script because something depends
  on them as `workspace:*`; `rspress-builder` and `templates` have no
  in-repo consumer today and carry none — one must be added the moment
  something starts depending on either.
- The scripts read as redundant next to turbo's task graph and are
  routinely proposed for removal on that basis; removal reintroduces the
  `Cannot find package` failure mode for anything that resolves a package
  outside a turbo invocation (a frozen install, the changesets engine, an
  MCP tool).
- `@savvy-web/changelog` must stay a root devDependency specifically
  because the changesets engine resolves the changelog id named in
  `.changeset/config.json` from the repo root — its `prepare` populating
  `dist/dev` is necessary but not sufficient without that root edge.
- `pnpm-workspace.yaml` must keep `autoInstallPeers: true` and
  `verifyDepsBeforeRun: false`, and must NOT add
  `injectWorkspacePackages`/`syncInjectedDepsAfterScripts`.
