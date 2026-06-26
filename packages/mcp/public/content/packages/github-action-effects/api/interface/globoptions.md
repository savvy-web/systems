---
id: packages/github-action-effects/api/interface/globoptions
title: "GlobOptions — github-action-effects interface"
summary: "Options mirroring `@actions/glob`'s `GlobOptions` (the documented subset)."
tier: packages
source: generated
tags: [github-action-effects, api]
priority: 0.3
related: []
---

# GlobOptions

Options mirroring `@actions/glob`'s `GlobOptions` (the documented subset).

```ts
interface GlobOptions
```

## Members

### followSymbolicLinks

```ts
readonly followSymbolicLinks?: boolean;
```

Follow symlinks while walking. Default true (matches `@actions/glob`).

### implicitDescendants

```ts
readonly implicitDescendants?: boolean;
```

Expand a directory match to its descendants. Default true.

### matchDirectories

```ts
readonly matchDirectories?: boolean;
```

Include directories themselves in results. Default false.

### omitBrokenSymbolicLinks

```ts
readonly omitBrokenSymbolicLinks?: boolean;
```

Suppress errors on broken symlinks. Default true.
