---
id: packages/silk-effects/api/class/workspaceanalysiserror
title: "WorkspaceAnalysisError — silk-effects class"
summary: "Raised when workspace analysis fails for a given root directory."
tier: packages
source: generated
tags: [silk-effects, api]
priority: 0.3
related: []
---

# WorkspaceAnalysisError

Raised when workspace analysis fails for a given root directory.

```ts
class WorkspaceAnalysisError extends WorkspaceAnalysisError_base<{
  readonly root: string;
  readonly reason: string;
}>
```

## Members

### message

```ts
get message(): string;
```

### reason

```ts
readonly reason: string;
```

### root

```ts
readonly root: string;
```
