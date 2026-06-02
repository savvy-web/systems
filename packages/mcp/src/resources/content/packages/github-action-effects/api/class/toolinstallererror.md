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
    readonly tool: string;
    readonly version: string;
    readonly operation: "download" | "extract" | "cache" | "path" | "chmod";
    readonly reason: string;
    readonly statusCode?: number | undefined;
}>
```

## Members

### operation

```ts
readonly operation: "download" | "extract" | "cache" | "path" | "chmod";
```

The operation that failed.

### reason

```ts
readonly reason: string;
```

Human-readable description.

### statusCode

```ts
readonly statusCode?: number | undefined;
```

HTTP status code, when the failure is HTTP-driven.

### tool

```ts
readonly tool: string;
```

The tool name.

### version

```ts
readonly version: string;
```

The tool version.
