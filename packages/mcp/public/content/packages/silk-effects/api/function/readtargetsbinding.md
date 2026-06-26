---
id: packages/silk-effects/api/function/readtargetsbinding
title: "readTargetsBinding — silk-effects function"
summary: "Read the bundler's `<pkgPath>/dist/prod/targets.json` binding via FileSystem."
tier: packages
source: generated
tags: [silk-effects, api]
priority: 0.3
related: []
---

# readTargetsBinding

Read the bundler's `<pkgPath>/dist/prod/targets.json` binding via FileSystem.

```ts
readTargetsBinding: (fs: FileSystem.FileSystem, pkgPath: string) => Effect.Effect<TargetsBinding | null>
```

## Parameters

- `fs` `FileSystem.FileSystem` — The FileSystem service.
- `pkgPath` `string` — Absolute path to the package directory.
