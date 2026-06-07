---
id: packages/rslib-builder/overview
title: rslib-builder overview
summary: Load when setting up or understanding the rslib-builder build for a Silk package.
tier: packages
source: hand
tags: [build]
priority: 0.5
related: [standards/catalog-usage, standards/publishability]
---

## What

`@savvy-web/rslib-builder` is a zero-config rsbuild-based build tool for Silk Suite
TypeScript packages. It reads a package's `exports` field to discover entry points,
builds dev and production outputs, generates type declarations, and transforms the
output `package.json` for publishing. A package opts in with a one-line
`rslib.config.ts`.

## API

```typescript
import { NodeLibraryBuilder } from "@savvy-web/rslib-builder";

export default NodeLibraryBuilder.create({
  externals: ["@rslib/core"], // optional: do not bundle these
});
```

Entry points come from `package.json` `exports` (e.g. `"."` → `./src/index.ts`,
`"./utils"` → `./src/utils/index.ts`). Peer dependencies are `@rslib/core` and
`@typescript/native-preview`.

## Layer

Build scripts:

```json
{
  "scripts": {
    "build": "rslib build --env-mode dev",
    "build:npm": "rslib build --env-mode npm"
  }
}
```

The dev build writes `dist/dev/` with bundled JS, source maps, declarations, and a
transformed `package.json`. The npm build writes `dist/npm/` optimized for publish
(no source maps, bundled declarations, a publish-ready `package.json`).

## Usage

The output `package.json` is transformed from source: export paths move from `.ts`
to `.js`, type conditions are added to exports, pnpm `catalog:` references resolve
to concrete versions, and the `files` array is generated. This is the mechanism
behind the convention that a source `package.json` is `private: true` while its
`publishConfig` declares publish intent — the builder flips `private` based on
`publishConfig.access` at build time.

First builds are slower due to cache warming; subsequent builds use `.rslib/cache/`.
A common pitfall: relative imports must use `.js` extensions (the ESM requirement),
or the build reports "cannot find module".

## Related

Dependency pinning the build resolves: `silk://standards/catalog-usage`. How
`private` and `publishConfig` decide what publishes:
`silk://standards/publishability`.
