---
id: packages/github-action-effects/api/class/npmregistryerror
title: "NpmRegistryError — github-action-effects class"
summary: "Error from npm registry operations."
tier: packages
source: generated
tags: [github-action-effects, api]
priority: 0.3
related: []
---

# NpmRegistryError

Error from npm registry operations.

```ts
class NpmRegistryError extends NpmRegistryError_base<{
    readonly pkg: string;
    readonly operation: "view" | "search" | "versions";
    readonly reason: string;
}>
```

## Members

### message

```ts
get message(): string;
```

Human-readable summary: `[<operation>] <pkg>: <reason>`.

### operation

```ts
readonly operation: "view" | "search" | "versions";
```

### pkg

```ts
readonly pkg: string;
```

### reason

```ts
readonly reason: string;
```
