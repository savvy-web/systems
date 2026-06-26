---
id: packages/github-action-effects/api/class/ioerror
title: "IoError — github-action-effects class"
summary: "Error when a filesystem I/O lookup (`which` / `findInPath`) fails."
tier: packages
source: generated
tags: [github-action-effects, api]
priority: 0.3
related: []
---

# IoError

Error when a filesystem I/O lookup (`which` / `findInPath`) fails.

```ts
class IoError extends IoError_base<{
  readonly operation: "which" | "findInPath"; /** The tool being looked up. */
  readonly tool: string; /** Human-readable description of what went wrong. */
  readonly reason: string;
}>
```

## Members

### operation

```ts
readonly operation: "which" | "findInPath";
```

The operation that failed.

### reason

```ts
readonly reason: string;
```

### tool

```ts
readonly tool: string;
```
