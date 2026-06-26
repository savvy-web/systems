---
id: packages/tsdown-plugins/api/interface/resolvedtsconfigoptions
title: "ResolvedTsconfigOptions — tsdown-plugins interface"
summary: "interface ResolvedTsconfigOptions from @savvy-web/tsdown-plugins."
tier: packages
source: generated
tags: [tsdown-plugins, api]
priority: 0.3
related: []
---

# ResolvedTsconfigOptions

```ts
interface ResolvedTsconfigOptions
```

## Members

### cwd

```ts
readonly cwd: string;
```

Absolute package root.

### jsx

```ts
readonly jsx?: string | undefined;
```

TS `compilerOptions.jsx` to forward into the dts tsconfig (e.g. "react-jsx").

### jsxImportSource

```ts
readonly jsxImportSource?: string | undefined;
```

TS `compilerOptions.jsxImportSource` to forward (e.g. "react").

### types

```ts
readonly types?: ReadonlyArray<string> | undefined;
```

Explicit `types` to forward (default ["node"]). Pulled from the project tsconfig by the caller.
