---
id: packages/tsdown-plugins/api/function/resolveportabletsconfig
title: "resolvePortableTsconfig — tsdown-plugins function"
summary: "Resolves the package's effective compiler options (following `extends`) into a portable, JSON-serializable tsconfig for the meta release bundle."
tier: packages
source: generated
tags: [tsdown-plugins, api]
priority: 0.3
related: []
---

# resolvePortableTsconfig

Resolves the package's effective compiler options (following `extends`) into a portable, JSON-serializable tsconfig for the meta release bundle.

```ts
function resolvePortableTsconfig(cwd: string, fallbackConfigPath?: string): PortableTsconfig;
```

## Parameters

- `cwd` `string` — Absolute package root.
- `fallbackConfigPath` `string` — Optional resolved tsconfig to use when the package has no own one.

## Returns

The portable tsconfig object.
