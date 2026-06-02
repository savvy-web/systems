---
id: packages/github-action-effects/api/class/configloadererror
title: "ConfigLoaderError — github-action-effects class"
summary: "Error from config loading operations."
tier: packages
source: generated
tags: [github-action-effects, api]
priority: 0.3
related: []
---

# ConfigLoaderError

Error from config loading operations.

```ts
class ConfigLoaderError extends ConfigLoaderError_base<{
    readonly path: string;
    readonly operation: "read" | "parse" | "validate";
    readonly reason: string;
}>
```

## Members

### operation

```ts
readonly operation: "read" | "parse" | "validate";
```

The operation that failed.

### path

```ts
readonly path: string;
```

The file path that caused the error.

### reason

```ts
readonly reason: string;
```

Human-readable description.
