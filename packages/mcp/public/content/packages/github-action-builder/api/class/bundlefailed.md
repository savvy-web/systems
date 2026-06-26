---
id: packages/github-action-builder/api/class/bundlefailed
title: "BundleFailed — github-action-builder class"
summary: "Error when bundling with rsbuild fails."
tier: packages
source: generated
tags: [github-action-builder, api]
priority: 0.3
related: []
---

# BundleFailed

Error when bundling with rsbuild fails.

```ts
class BundleFailed extends BundleFailedBase<{
  readonly entry: string;
  readonly cause: unknown;
}>
```

## Members

### cause

```ts
readonly cause: unknown;
```

The underlying error or error message.

### entry

```ts
readonly entry: string;
```

The entry file that failed to bundle.
