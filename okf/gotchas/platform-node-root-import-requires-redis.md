---
type: Gotcha
status: draft
title: The @effect/platform-node root import needs redis, and only Yarn 1 shows it
description: "Importing the root @effect/platform-node entry evaluates NodeRedis, which imports its required redis peer; npm, pnpm and bun auto-install that peer, so a shipped bin works everywhere except under Yarn 1, which fails with ERR_MODULE_NOT_FOUND 'redis'. Shipped code imports platform-node by subpath."
tags: [deps, compat]
stale_after: 2027-03-25T00:00:00Z
generated:
  by: okfit/claude-code
  at: 2026-09-26T22:54:36Z
  body_sha256: 73324bf48677a3e6733721d69559d7a61f41b90941d626079dadf7bdee65a317
sources:
  - id: fix-commit
    resource: https://github.com/savvy-web/systems/commit/9720310f9169161e18ec4532d843c5e2951fa8dd
    title: "fix(cli,mcp): import platform-node by subpath so yarn 1 installs run"
  - id: platform-node
    resource: npm:@effect/platform-node
  - id: mcp-main
    resource: ../../packages/mcp/src/main.ts
  - id: cli-main
    resource: ../../packages/cli/src/main.ts
  - id: packed-install
    resource: ../../e2e/silk/__test__/e2e/packed-install.e2e.test.ts
  - id: pending
    resource: conversation with the repository owner
    author: human:spencer
    last_modified: 2026-09-26T00:00:00Z
---

# The @effect/platform-node root import needs redis, and only Yarn 1 shows it

## What you see

A bin that imports `@effect/platform-node` from its root entry (`import { NodeRuntime } from "@effect/platform-node"`) installs and runs cleanly under npm, pnpm and bun, in the workspace and from a packed tarball alike. Under Yarn 1 the same install finishes, and then the bin dies at startup with `ERR_MODULE_NOT_FOUND` for `redis`. Nothing in this repository depends on Redis, so the error reads as a broken Yarn install rather than a bug in the shipped code.[^fix-commit]

## What you will wrongly conclude

That the package is fine and Yarn 1 is at fault, since three of four managers pass. Or that `redis` is an optional extra the root entry loads lazily.

## What is actually true

The root entry is a barrel that re-exports every module, including `NodeRedis`, and `NodeRedis` has a top-level static `import { createClient } from "redis"`. `redis` is a required (not optional) peer dependency of `@effect/platform-node` — `>=5.0.0 <7.0.0` at `4.0.0-rc.117` — so evaluating the barrel requires it.[^platform-node] npm 7+, pnpm and bun auto-install required peers, which puts `redis` into every consumer's tree and hides the dependency. Yarn 1 never installs peers, so it is the only manager that reports the truth. Code that only needs `NodeRuntime`, `NodeServices`, `NodeFileSystem` or `NodePath` pulls in `redis` for nothing.

## The rule

Shipped code imports platform-node by subpath: `import * as NodeRuntime from "@effect/platform-node/NodeRuntime"`, `import * as NodeServices from "@effect/platform-node/NodeServices"`, and so on. That includes dynamic imports (`await import("@effect/platform-node/NodeRuntime")`, as in savvy-mcp's `load`).[^mcp-main][^cli-main] Test files may keep the root import, since they never reach a consumer. The packed-install e2e runs the silk closure under Yarn as well as npm, pnpm and bun, so it catches a regression in the `savvy`/`savvy-mcp` bins.[^packed-install]

Still on the root import in shipped source and pending a decision by the repository owner: `packages/github-action-builder/src/cli/index.ts`, and three tsdown-plugins files (`src/catalog/resolve-catalogs.ts`, `src/meta/tsdoctor-source.ts`, `src/changesets/next-versions.ts`).[^pending] The root import in `packages/silk-effects/src/changesets/services/deps-regen.ts` is a TSDoc example, not code.

[^fix-commit]: <https://github.com/savvy-web/systems/commit/9720310f9169161e18ec4532d843c5e2951fa8dd>
[^platform-node]: `npm:@effect/platform-node`
[^mcp-main]: `../../packages/mcp/src/main.ts`
[^cli-main]: `../../packages/cli/src/main.ts`
[^packed-install]: `../../e2e/silk/__test__/e2e/packed-install.e2e.test.ts`
[^pending]: conversation with the repository owner
