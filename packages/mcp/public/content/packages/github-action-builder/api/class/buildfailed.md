---
id: packages/github-action-builder/api/class/buildfailed
title: "BuildFailed — github-action-builder class"
summary: "Error when the build process fails overall."
tier: packages
source: generated
tags: [github-action-builder, api]
priority: 0.3
related: []
---

# BuildFailed

Error when the build process fails overall.

```ts
class BuildFailed extends BuildFailedBase<{
  readonly message: string;
  readonly failedEntries: number;
}>
```

## Members

### failedEntries

```ts
readonly failedEntries: number;
```

Number of entries that failed.

### message

```ts
readonly message: string;
```

Summary message of the build failure.
