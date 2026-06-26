---
id: packages/github-action-effects/api/variable/pathutils
title: "PathUtils — github-action-effects variable"
summary: "Pure path-normalization helpers, matching `@actions/core` path utilities."
tier: packages
source: generated
tags: [github-action-effects, api]
priority: 0.3
related: []
---

# PathUtils

Pure path-normalization helpers, matching `@actions/core` path utilities.

```ts
PathUtils: {
  readonly toPosixPath: (pth: string) => string; /** Normalize forward slashes to backslashes. Matches `@actions/core.toWin32Path`. */
  readonly toWin32Path: (pth: string) => string; /** Normalize both separators to the platform separator. Matches `@actions/core.toPlatformPath`. */
  readonly toPlatformPath: (pth: string) => string;
}
```

## Examples

```ts
import { PathUtils } from "@savvy-web/github-action-effects"

PathUtils.toPosixPath("a\\b") // "a/b"

```
