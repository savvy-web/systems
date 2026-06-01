---
id: guides/choosing-a-builder
title: Choosing a builder (rslib vs bun)
summary: When to reach for @savvy-web/rslib-builder vs @savvy-web/bun-builder for a Silk package.
tier: guides
source: hand
tags: [build]
priority: 0.5
related: [packages/rslib-builder/overview]
---

## Overview

The Silk Suite has two zero-config build tools for TypeScript libraries:

| Package | Bundler core | Primary target |
| --- | --- | --- |
| `@savvy-web/rslib-builder` | rsbuild / rspack | Node.js (pnpm monorepos) |
| `@savvy-web/bun-builder` | Bun.build() | Bun monorepos |

Both tools auto-detect entry points from `package.json` `exports`, emit `dist/dev/`
and `dist/npm/` build modes, generate rolled-up `.d.ts` declarations via API
Extractor, resolve `catalog:` and `workspace:` protocol references for publishing,
and transform the output `package.json` for publish readiness.

## `@savvy-web/rslib-builder`

The **ecosystem default** for packages inside the `savvy-web/systems` monorepo and
any pnpm-managed Silk Suite package.

### What it does

- Zero-config builds via `NodeLibraryBuilder.create({})` in `rslib.config.ts`
- Reads `exports` to discover entry points; builds `dist/dev/` and `dist/npm/`
- Generates type declarations and emits a Microsoft API Extractor model
  (`<unscoped>.api.json`) on the npm build
- Transforms the output `package.json`: resolves `pnpm catalog:` references,
  flips `private: true` to publish-ready based on `publishConfig.access`, rewrites
  export paths from `.ts` to `.js`, adds type conditions
- Supports dual-format ESM+CJS builds when needed (e.g. `@savvy-web/silk` for CJS
  consumers)
- Peer dependencies: `@rslib/core`, `@typescript/native-preview`

### Configuration

```typescript
import { NodeLibraryBuilder } from "@savvy-web/rslib-builder";

export default NodeLibraryBuilder.create({
  externals: ["effect", "@effect/platform"],
  apiModel: {
    tsdoc: {
      tagDefinitions: [{ tagName: "@since", syntaxKind: "block" }],
    },
  },
});
```

Pass `apiModel: true` (or an options object) to enable API Extractor model
emission. See `silk://packages/rslib-builder/overview` for full details.

### When to use it

- You are building a package inside `savvy-web/systems` (or a pnpm-based Silk repo)
- You need dual-format ESM+CJS output
- You want API Extractor model emission for MCP doc generation
- The package uses `pnpm catalog:` or `workspace:` protocol in its dependencies

## `@savvy-web/bun-builder`

For **Bun-managed monorepos** where Bun.build() is the preferred bundler.

### What it does

- Zero-config builds via `BunLibraryBuilder.create({})` in `bun.config.ts`
- Auto-detects entry points from `package.json` `exports`
- Bundled or bundleless output (`bundle: false` preserves source structure)
- Rolled-up `.d.ts` in bundled mode; raw `.d.ts` in bundleless mode
- API Extractor model generation on npm builds (enabled by default)
- TSDoc warnings reported with source locations; severity configurable per
  environment (`"fail"` in CI, `"log"` locally)
- Resolves Bun `catalog:` and `workspace:` protocol references for publishing
- Peer dependencies: `@microsoft/api-extractor`, `@typescript/native-preview`,
  `typescript`, `@types/bun`

### Configuration

```typescript
import { BunLibraryBuilder } from "@savvy-web/bun-builder";

export default BunLibraryBuilder.create({
  bundle: true,       // default; set false for bundleless
  apiModel: true,     // default; emits model on npm build
});
```

Build via:

```bash
bun run bun.config.ts              # all modes
bun run bun.config.ts --env-mode dev
bun run bun.config.ts --env-mode npm
```

### When to use it

- You are in a Bun-managed workspace (`bun.lock`, Bun catalog protocol)
- You want sub-second build iteration times
- You do not need rspack's CJS-to-ESM interop (which is important for certain
  bundled GitHub Actions scenarios)

## Decision guide

```text
Is this a package in savvy-web/systems (pnpm monorepo)?
  Yes → rslib-builder

Does the package need dual-format ESM+CJS output?
  Yes → rslib-builder

Is this a Bun-managed workspace?
  Yes → bun-builder

Are you building a GitHub Action (bundled Node.js 24 binary)?
  Use @savvy-web/github-action-builder instead — see silk://guides/building-a-github-action
```

## Common pitfalls

**rslib-builder:** Relative imports inside source must use `.js` extensions
(ESM requirement). The build will report "cannot find module" on missing extensions.

**bun-builder:** The Bun catalog protocol uses `workspaces.catalog` in the root
`package.json`, distinct from pnpm's catalog. Do not mix the two in the same
workspace.

## See also

- `silk://packages/rslib-builder/overview` — full rslib-builder reference
- `silk://guides/building-a-github-action` — GitHub Actions use a separate builder
