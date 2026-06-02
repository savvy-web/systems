---
id: packages/silk-effects/api/class/resolvedtool
title: "ResolvedTool — silk-effects class"
summary: "Result of resolving a ToolDefinition. Provides exec and dlx to build commands for the resolved tool."
tier: packages
source: generated
tags: [silk-effects, api]
priority: 0.3
related: []
---

# ResolvedTool

Result of resolving a [ToolDefinition](silk://packages/silk-effects/api/class/tooldefinition). Provides exec and dlx to build commands for the resolved tool.

```ts
class ResolvedTool extends ResolvedTool_base
```

## Members

### [Equal.symbol]

```ts
[Equal.symbol](that: Equal.Equal): boolean;
```

### [Hash.symbol]

```ts
[Hash.symbol](): number;
```

### dlx

```ts
dlx(...args: string[]): ToolCommand;
```

### exec

```ts
exec(...args: string[]): ToolCommand;
```

### hasVersionMismatch

```ts
get hasVersionMismatch(): boolean;
```

### isGlobal

```ts
get isGlobal(): boolean;
```

### isLocal

```ts
get isLocal(): boolean;
```
