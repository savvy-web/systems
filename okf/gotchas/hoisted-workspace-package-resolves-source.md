---
type: Gotcha
status: draft
title: A public-hoisted workspace package resolves to its source tree, not its built artifact
description: "Hoisting a workspace package via publicHoistPattern symlinks the package's source directory and ignores publishConfig.directory, so a tool that resolves it by id loads raw TypeScript through Node's type-stripping and looks like it works."
resource: ../../packages/pnpm-plugin-silk/savvy.build.ts
tags: [deps, release, build]
stale_after: 2027-03-17T00:00:00Z
generated:
  by: okfit/claude-code
  at: 2026-09-18T02:06:56Z
  body_sha256: f07552401813c001221e8780546d04f5bb4d7a4b1f2d59d64e243782bc7baddf
sources:
  - id: hoist-config
    resource: ../../packages/pnpm-plugin-silk/savvy.build.ts
  - id: root-manifest
    resource: ../../package.json
  - id: changelog-manifest
    resource: ../../packages/changelog/package.json
---

# A public-hoisted workspace package resolves to its source tree, not its built artifact

## What you see

`pnpm changeset version` (or the `changeset_preview` MCP tool) runs cleanly
in this repository and produces a plausible changelog. Nothing in the output
says which copy of `@savvy-web/changelog` the changesets engine loaded. If
`@savvy-web/changelog` is in `@savvy-web/pnpm-plugin-silk`'s
`publicHoistPattern` for this repo, `node_modules/@savvy-web/changelog` is a
symlink into `packages/changelog` — the source package — and the run still
"works".[^hoist-config]

## What you will wrongly conclude

That the hoist is what makes the id resolvable from the repo root, and that
the root `devDependencies` entry for `@savvy-web/changelog` is redundant —
or, from the other side, that the `excludeByRepo` entry dropping the hoist
for `savvy-web-systems` is a leftover that can go.[^hoist-config][^root-manifest]

## What is actually true

`publicHoistPattern` symlinks the workspace package's directory as-is; it
never consults `publishConfig.directory`. `packages/changelog/package.json`
has `exports: { ".": "./src/index.ts" }` (the build rewrites it for the
published artifact), so a hoisted resolution hands the changesets engine
raw TypeScript, which Node 24 executes through native type-stripping. The
green result exercises the source file, not the built `dist/dev/pkg`
artifact that consumers actually install — any bundling, externalization
or manifest-transform defect in the build is invisible to that run.[^changelog-manifest]

The root `devDependencies` `"@savvy-web/changelog": "workspace:*"` is what
guarantees the artifact is loaded: pnpm links a `workspace:*` dependency
through `publishConfig.directory` + `linkDirectory: true`, so the root
`node_modules/@savvy-web/changelog` points at `dist/dev/pkg` (built by the
package's own `prepare`). That is why the hub keeps the root devDependency
AND keeps the hoist excluded for `savvy-web-systems` — a public hoist would
shadow the built link with the source tree.[^root-manifest][^hoist-config]

Consumer repositories are not affected: there `@savvy-web/changelog` is a
registry package (carried by `@savvy-web/silk` as an exact-pinned
dependency), and the hoist symlinks its published `dist`, which is the
whole reason the hoist exists.

## Related

- [`modules/changelog.md`](../modules/changelog.md)
- [`modules/pnpm-plugin-silk.md`](../modules/pnpm-plugin-silk.md)
- [`conventions/workspace-prepare-scripts.md`](../conventions/workspace-prepare-scripts.md)
- [`decisions/per-package-prepare-builds.md`](../decisions/per-package-prepare-builds.md)

[^hoist-config]: `../../packages/pnpm-plugin-silk/savvy.build.ts` — the `publicHoistPattern.excludeByRepo` block
[^root-manifest]: `../../package.json` — root `devDependencies`
[^changelog-manifest]: `../../packages/changelog/package.json`
