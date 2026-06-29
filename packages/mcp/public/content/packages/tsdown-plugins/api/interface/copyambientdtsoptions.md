---
id: packages/tsdown-plugins/api/interface/copyambientdtsoptions
title: "CopyAmbientDtsOptions — tsdown-plugins interface"
summary: "interface CopyAmbientDtsOptions from @savvy-web/tsdown-plugins."
tier: packages
source: generated
tags: [tsdown-plugins, api]
priority: 0.3
related: []
---

# CopyAmbientDtsOptions

```ts
interface CopyAmbientDtsOptions
```

## Members

### ambient

```ts
readonly ambient: ReadonlyArray<AmbientDtsEntry>;
```

The ambient exports to copy (from `extractAmbientDts`).

### outDir

```ts
readonly outDir: string;
```

The built package dir to copy into (e.g. `dist/dev/pkg`).

### srcCwd

```ts
readonly srcCwd: string;
```

Package root the `source` paths are relative to.
