---
id: packages/github-action-builder/api/function/defineconfig
title: "defineConfig — github-action-builder function"
summary: "Define a configuration with full TypeScript support."
tier: packages
source: generated
tags: [github-action-builder, api]
priority: 0.3
related: []
---

# defineConfig

Define a configuration with full TypeScript support.

```ts
function defineConfig(config?: Partial<ConfigInput>): Config;
```

## Parameters

- `config` `Partial<ConfigInput>` — Partial configuration object

## Returns

Fully resolved configuration with defaults applied

## Examples

```typescript
// action.config.ts
import { defineConfig } from "@savvy-web/github-action-builder";

export default defineConfig({
  entries: {
    main: "src/main.ts",
  },
  build: {
    minify: true,
  },
});

```

```typescript
// action.config.ts
import { defineConfig } from "@savvy-web/github-action-builder";

export default defineConfig({
  entries: {
    main: "src/action.ts",
    pre: "src/setup.ts",
    post: "src/cleanup.ts",
  },
  build: {
    minify: true,
    sourceMap: true,
    externals: ["@aws-sdk/client-s3"],
    ignore: ["libxmljs2"],
  },
  validation: {
    requireActionYml: true,
    maxBundleSize: "10mb",
    strict: true,
  },
});

```
