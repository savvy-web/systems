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
  readonly path: string; /** The operation that failed. */
  readonly operation: "read" | "parse" | "validate"; /** Human-readable description. */
  readonly reason: string;
}>
```

## Members

### operation

```ts
readonly operation: "read" | "parse" | "validate";
```

### path

```ts
readonly path: string;
```

The file path that caused the error.

### reason

```ts
readonly reason: string;
```
