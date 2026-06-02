---
id: packages/github-action-effects/api/class/packagemanagererror
title: "PackageManagerError — github-action-effects class"
summary: "Error from package manager operations."
tier: packages
source: generated
tags: [github-action-effects, api]
priority: 0.3
related: []
---

# PackageManagerError

Error from package manager operations.

```ts
class PackageManagerError extends PackageManagerError_base<{
    readonly pm: string | undefined;
    readonly operation: "detect" | "install" | "cache" | "exec";
    readonly reason: string;
}>
```

## Members

### operation

```ts
readonly operation: "detect" | "install" | "cache" | "exec";
```

The operation that failed.

### pm

```ts
readonly pm: string | undefined;
```

The package manager involved, if known.

### reason

```ts
readonly reason: string;
```

Human-readable description.
