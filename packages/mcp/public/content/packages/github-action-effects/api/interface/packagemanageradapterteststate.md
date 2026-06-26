---
id: packages/github-action-effects/api/interface/packagemanageradapterteststate
title: "PackageManagerAdapterTestState — github-action-effects interface"
summary: "Test state for PackageManagerAdapter."
tier: packages
source: generated
tags: [github-action-effects, api]
priority: 0.3
related: []
---

# PackageManagerAdapterTestState

Test state for [PackageManagerAdapter](silk://packages/github-action-effects/api/class/packagemanageradapter).

```ts
interface PackageManagerAdapterTestState
```

## Members

### cachePaths

```ts
readonly cachePaths: Array<string>;
```

Cache paths to return.

### execCalls

```ts
readonly execCalls: Array<{
    args: Array<string>;
    options: ExecOptions | undefined;
  }>;
```

Recorded exec calls.

### info

```ts
readonly info: PackageManagerInfo;
```

The package manager info to return from detect.
