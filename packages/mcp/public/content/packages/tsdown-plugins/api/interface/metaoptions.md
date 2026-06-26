---
id: packages/tsdown-plugins/api/interface/metaoptions
title: "MetaOptions — tsdown-plugins interface"
summary: "The `meta` field on defineBuild. Absent means no api-model generation."
tier: packages
source: generated
tags: [tsdown-plugins, api]
priority: 0.3
related: []
---

# MetaOptions

The `meta` field on defineBuild. Absent means no api-model generation.

```ts
interface MetaOptions
```

## Members

### localPaths

```ts
readonly localPaths?: ReadonlyArray<string> | undefined;
```

Directories to copy the canonical group's api-model into after `savvy build --target prod`.

### optimistic

```ts
readonly optimistic?: "auto" | boolean | undefined;
```

Forward-look the meta bundle's own `version` and workspace-sibling dep versions to their NEXT release version from pending changesets. `"auto"` (default) is `false` under CI (`CI`/`GITHUB_ACTIONS` set) and `true` locally, so a local bundle matches the CI release build.

### tsdoc

```ts
readonly tsdoc?: TsdocOptions | undefined;
```
