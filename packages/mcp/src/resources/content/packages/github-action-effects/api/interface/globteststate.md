---
id: packages/github-action-effects/api/interface/globteststate
title: "GlobTestState — github-action-effects interface"
summary: "In-memory glob state for testing. Maps a patterns string to its matched paths and to a precomputed hash, so a test can pre-seed results without touching disk."
tier: packages
source: generated
tags: [github-action-effects, api]
priority: 0.3
related: []
---

# GlobTestState

In-memory glob state for testing. Maps a patterns string to its matched paths and to a precomputed hash, so a test can pre-seed results without touching disk.

```ts
interface GlobTestState
```

## Members

### hashes

```ts
readonly hashes: Map<string, string>;
```

### matches

```ts
readonly matches: Map<string, ReadonlyArray<string>>;
```
