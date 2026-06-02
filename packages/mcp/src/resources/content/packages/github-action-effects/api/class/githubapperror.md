---
id: packages/github-action-effects/api/class/githubapperror
title: "GitHubAppError — github-action-effects class"
summary: "Error from GitHub App authentication operations."
tier: packages
source: generated
tags: [github-action-effects, api]
priority: 0.3
related: []
---

# GitHubAppError

Error from GitHub App authentication operations.

```ts
class GitHubAppError extends GitHubAppError_base<{
    readonly operation: "jwt" | "token" | "revoke" | "identity";
    readonly reason: string;
}>
```

## Members

### operation

```ts
readonly operation: "jwt" | "token" | "revoke" | "identity";
```

The operation that failed.

### reason

```ts
readonly reason: string;
```

Human-readable description.
