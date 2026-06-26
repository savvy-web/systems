---
id: packages/bundler/overview
title: bundler overview
summary: Load when setting up or understanding the @savvy-web/bundler build for a Silk library package.
tier: packages
source: hand
tags: [bundler, build]
priority: 0.5
related: [standards/catalog-usage, standards/publishability, standards/api-model-pipeline]
---

## What

`@savvy-web/bundler` is the tsdown-based build orchestrator for Silk Suite
TypeScript libraries. It reads a package's `exports` field to discover entry
points, builds dev and production outputs, emits a bundled self-contained
`.d.ts` per public entry, and transforms the output `package.json` for
publishing. It drives tsdown programmatically over `@savvy-web/tsdown-plugins`.
A package opts in with a one-line self-executing `savvy.build.ts`.

## API

The front door is `defineBuild` (pure config normalization + validation) and
`runBuild` (the orchestrator). A package's `savvy.build.ts` defines a config and
self-runs when invoked directly:

```typescript
import { defineBuild, runBuild } from "@savvy-web/bundler";

const config = defineBuild({
  // format defaults to esm-only; minify defaults false (prod-only).
});

export default config;

if (import.meta.main) {
  await runBuild(config, { cwd: import.meta.dirname, argv: process.argv.slice(2) });
}
```

Entry points come from `package.json` `exports`. `defineBuild` options include
`format`, `jsx`, `bundle`, `overrides` (per-entry format and bundling
partitions), `define`, `looseFiles`, `bundleNodeModules`, `plugins` (custom
rolldown plugins), and `meta` (API-model generation — see below). Imported by
the cli or the silk plugin, the config object is side-effect-free; run directly,
it parses `process.argv` and builds.

## Layer

Build scripts invoke the file directly with Node's native type-stripping:

```json
{
  "scripts": {
    "build:dev": "node savvy.build.ts --target dev",
    "build:prod": "node savvy.build.ts --target prod"
  }
}
```

`--target dev` writes `dist/dev/` (bundled JS, source maps, declarations, a
transformed `package.json`). `--target prod` writes `dist/prod/<target>/` for
each `publishConfig.targets` key, emits the API model and meta release asset, and
strips declaration source maps from the published bytes.

## Usage

The output `package.json` is transformed from source by `defaultManifestTransform`:
export paths move from `.ts` to `.js`, type conditions are added, pnpm `catalog:`
and `workspace:` references resolve to concrete versions, and `private` is flipped
to publish-ready based on `publishConfig.access`. This is the mechanism behind the
convention that a source `package.json` is `private: true` while its
`publishConfig` declares publish intent.

The `meta` option is tri-state: omit it to generate the API model with default
options on `--target prod`, pass an object to override (`localPaths`, `tsdoc`,
`optimistic`), or pass `false` to opt out. Custom TSDoc tags are registered via
`meta.tsdoc.tagDefinitions`. The package also ships the shared TS base config at
`@savvy-web/bundler/tsconfig/ecma.json`, which every Silk library extends.

A common pitfall: relative imports must use `.js` extensions (the ESM
requirement), or the build reports "cannot find module".

## Related

The symbol-level API reference: `silk://packages/bundler/api`. Dependency
pinning the build resolves: `silk://standards/catalog-usage`. How `private` and
`publishConfig` decide what publishes: `silk://standards/publishability`. How the
prod build's API model becomes generated docs: `silk://standards/api-model-pipeline`.
