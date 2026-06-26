---
id: packages/silk-effects/api/class/versioningdetectionerror
title: "VersioningDetectionError — silk-effects class"
summary: "Raised when the versioning strategy cannot be determined from the workspace state."
tier: packages
source: generated
tags: [silk-effects, api]
priority: 0.3
related: []
---

# VersioningDetectionError

Raised when the versioning strategy cannot be determined from the workspace state.

```ts
class VersioningDetectionError extends VersioningDetectionError_base<{
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
