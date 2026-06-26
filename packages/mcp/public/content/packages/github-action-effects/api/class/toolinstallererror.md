---
id: packages/github-action-effects/api/class/toolinstallererror
title: "ToolInstallerError — github-action-effects class"
summary: "Error from tool installation operations."
tier: packages
source: generated
tags: [github-action-effects, api]
priority: 0.3
related: []
---

# ToolInstallerError

Error from tool installation operations.

```ts
class ToolInstallerError extends ToolInstallerError_base<{
  readonly tool: string; /** The tool version. */
  readonly version: string; /** The operation that failed. */
  readonly operation: "download" | "extract" | "cache" | "path" | "chmod"; /** Human-readable description. */
  readonly reason: string; /** HTTP status code, when the failure is HTTP-driven. */
  readonly statusCode?: number | undefined;
}>
```

## Members

### operation

```ts
readonly operation: "download" | "extract" | "cache" | "path" | "chmod";
```

### reason

```ts
readonly reason: string;
```

### statusCode

```ts
readonly statusCode?: number | undefined;
```

### tool

```ts
readonly tool: string;
```

The tool name.

### version

```ts
readonly version: string;
```
