---
id: packages/tsdown-plugins/api/interface/portabletsconfig
title: "PortableTsconfig — tsdown-plugins interface"
summary: "Portable, JSON-serializable tsconfig.json (compilerOptions-only)."
tier: packages
source: generated
tags: [tsdown-plugins, api]
priority: 0.3
related: []
---

# PortableTsconfig

Portable, JSON-serializable tsconfig.json (compilerOptions-only).

```ts
interface PortableTsconfig
```

## Members

### $schema

```ts
$schema: string;
```

JSON schema for IDE support.

### compilerOptions

```ts
compilerOptions: ResolvedCompilerOptions;
```

Compiler options with enum values converted to strings.
