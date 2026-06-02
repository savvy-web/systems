---
id: packages/silk-effects/api/class/tooldefinition
title: "ToolDefinition — silk-effects class"
summary: "Declares a CLI tool's identity and resolution constraints. Equal compares on `name` only (identity)."
tier: packages
source: generated
tags: [silk-effects, api]
priority: 0.3
related: []
---

# ToolDefinition

Declares a CLI tool's identity and resolution constraints. Equal compares on `name` only (identity).

```ts
class ToolDefinition implements Equal.Equal
```

## Members

### _tag

```ts
readonly _tag: "ToolDefinition";
```

### [Equal.symbol]

```ts
[Equal.symbol](that: Equal.Equal): boolean;
```

### [Hash.symbol]

```ts
[Hash.symbol](): number;
```

### make

```ts
static make(options: {
        readonly name: string;
        readonly versionExtractor?: VersionExtractor;
        readonly policy?: ResolutionPolicy;
        readonly source?: SourceRequirement;
    }): ToolDefinition;
```

### name

```ts
readonly name: string;
```

### policy

```ts
readonly policy: ResolutionPolicy;
```

### source

```ts
readonly source: SourceRequirement;
```

### versionExtractor

```ts
readonly versionExtractor: VersionExtractor;
```
