---
id: packages/github-action-effects/api/class/changeseterror
title: "ChangesetError — github-action-effects class"
summary: "Error from changeset operations."
tier: packages
source: generated
tags: [github-action-effects, api]
priority: 0.3
related: []
---

# ChangesetError

Error from changeset operations.

```ts
class ChangesetError extends ChangesetError_base<{
  readonly operation: "parse" | "generate" | "read"; /** Human-readable description. */
  readonly reason: string;
}>
```

## Members

### operation

```ts
readonly operation: "parse" | "generate" | "read";
```

The operation that failed.

### reason

```ts
readonly reason: string;
```
