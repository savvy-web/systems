---
id: guides/choosing-a-builder
title: Choosing a builder
summary: When to reach for @savvy-web/bundler, @savvy-web/rspress-builder, or @savvy-web/github-action-builder for a Silk package.
tier: guides
source: hand
tags: [build]
priority: 0.5
related: [packages/bundler/overview, guides/building-a-github-action]
---

## Overview

The Silk Suite has three zero-config build tools, each targeting a different
output shape. Pick by what the package produces, not by personal preference.

| Package | Builds | Output |
| --- | --- | --- |
| `@savvy-web/bundler` | TypeScript libraries | npm-published `dist/dev` + `dist/prod` |
| `@savvy-web/rspress-builder` | RSPress doc-site plugins | npm-published plugin package |
| `@savvy-web/github-action-builder` | Node.js 24 GitHub Actions | committed single-file ESM bundles |

All three auto-detect their inputs, emit a transformed publish-ready
`package.json` where applicable, and resolve `catalog:` and `workspace:` protocol
references. They differ in what they emit and how it is consumed.

## `@savvy-web/bundler`

The **default** for any TypeScript library inside `savvy-web/systems` (or any
pnpm-managed Silk Suite package). It is the tsdown-based build orchestrator: it
reads `exports` to discover entry points, builds `dist/dev/` and per-target
`dist/prod/<target>/`, emits a bundled self-contained `.d.ts` per public entry,
and on `--target prod` emits an API Extractor model for MCP and website doc
generation.

A package opts in with a self-executing `savvy.build.ts` that calls `defineBuild`
and `runBuild`, with `node savvy.build.ts --target dev` / `--target prod` build
scripts. See `silk://packages/bundler/overview` for the full surface.

### When to use it

- You are building a library inside `savvy-web/systems` (or a pnpm-based Silk repo)
- You publish to npm and want bundled type declarations
- You want API Extractor model emission for MCP doc generation
- The package uses `pnpm catalog:` or `workspace:` protocol in its dependencies

## `@savvy-web/rspress-builder`

A thin sibling to the bundler for **RSPress documentation-site plugins**. It
applies the same entry-point discovery and publish transform, tuned for the
shape an RSPress plugin package ships. Reach for it only when the package is an
RSPress plugin; for every other library, use the bundler.

## `@savvy-web/github-action-builder`

For **Node.js 24 GitHub Actions**, whose output is a different shape entirely:
self-contained ESM bundles committed to the repository (not an npm package) so a
runner can execute them directly. It bundles `src/main.ts` (plus optional
`pre.ts`/`post.ts`) into flat `dist/*.js` files and validates `action.yml`. See
`silk://guides/building-a-github-action`.

### When to use it

- You are building a GitHub Action, not a published library
- The output must be a committed single-file bundle referenced from `action.yml`

## Decision guide

```text
Is the package a GitHub Action (committed Node.js 24 bundle)?
  Yes → github-action-builder

Is the package an RSPress doc-site plugin?
  Yes → rspress-builder

Otherwise (any npm-published TypeScript library)
  → bundler
```

## Common pitfalls

**bundler / rspress-builder:** Relative imports inside source must use `.js`
extensions (the ESM requirement). The build reports "cannot find module" on a
missing extension.

**github-action-builder:** The `dist/` bundle must be committed so GitHub runners
can execute it; `action.yml` must declare `runs.using: "node24"`.

## See also

- `silk://packages/bundler/overview` — the library build front door in full
- `silk://guides/building-a-github-action` — GitHub Actions use a separate builder
- `silk://standards/api-model-pipeline` — how the bundler's prod API model becomes docs
