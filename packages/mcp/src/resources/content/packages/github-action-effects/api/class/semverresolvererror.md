---
id: packages/github-action-effects/api/class/semverresolvererror
title: "SemverResolverError — github-action-effects class"
summary: "Error when a semver operation fails due to invalid input."
tier: packages
source: generated
tags: [github-action-effects, api]
priority: 0.3
related: []
---

# SemverResolverError

Error when a semver operation fails due to invalid input.

```ts
class SemverResolverError extends SemverResolverError_base<{
    readonly operation: "compare" | "satisfies" | "latestInRange" | "increment" | "parse";
    readonly version: string;
    readonly reason: string;
}>
```

## Members

### operation

```ts
readonly operation: "compare" | "satisfies" | "latestInRange" | "increment" | "parse";
```

The operation that failed.

### reason

```ts
readonly reason: string;
```

Human-readable description of what went wrong.

### version

```ts
readonly version: string;
```

The version string involved.
