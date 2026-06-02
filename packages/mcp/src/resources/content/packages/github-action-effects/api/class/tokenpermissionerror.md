---
id: packages/github-action-effects/api/class/tokenpermissionerror
title: "TokenPermissionError — github-action-effects class"
summary: "Error when token permissions are insufficient or over-scoped."
tier: packages
source: generated
tags: [github-action-effects, api]
priority: 0.3
related: []
---

# TokenPermissionError

Error when token permissions are insufficient or over-scoped.

```ts
class TokenPermissionError extends TokenPermissionError_base<{
    readonly missing: Array<{
        permission: string;
        required: string;
        granted?: string;
    }>;
    readonly extra?: Array<{
        permission: string;
        level: string;
    }>;
    readonly reason: string;
}>
```

## Members

### extra

```ts
readonly extra?: Array<{
        permission: string;
        level: string;
    }>;
```

Permissions granted but not required.

### missing

```ts
readonly missing: Array<{
        permission: string;
        required: string;
        granted?: string;
    }>;
```

Permissions that are missing or insufficient.

### reason

```ts
readonly reason: string;
```

Human-readable description of the permission issue.
