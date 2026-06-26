---
id: packages/github-action-effects/api/class/sbomerror
title: "SbomError — github-action-effects class"
summary: "Errors raised by Sbom operations. - `\"build\"` — failed to construct the Bom model (bad input) - `\"serialize\"` — failed to serialize to JSON - `\"save\"` — failed…"
tier: packages
source: generated
tags: [github-action-effects, api]
priority: 0.3
related: []
---

# SbomError

Errors raised by [Sbom](silk://packages/github-action-effects/api/class/sbom) operations. - `"build"` — failed to construct the Bom model (bad input) - `"serialize"` — failed to serialize to JSON - `"save"` — failed to write the BOM file to disk

```ts
class SbomError extends SbomError_base<{
  readonly reason: "build" | "serialize" | "save";
  readonly message: string;
  readonly cause?: unknown;
}>
```

## Members

### cause

```ts
readonly cause?: unknown;
```

### message

```ts
readonly message: string;
```

### reason

```ts
readonly reason: "build" | "serialize" | "save";
```
