---
id: packages/tsdown-plugins/api/interface/loosefilespec
title: "LooseFileSpec — tsdown-plugins interface"
summary: "One standalone bundled output file, declared by its literal output filename."
tier: packages
source: generated
tags: [tsdown-plugins, api]
priority: 0.3
related: []
---

# LooseFileSpec

One standalone bundled output file, declared by its literal output filename.

```ts
interface LooseFileSpec
```

## Members

### format

```ts
readonly format?: BuildFormat | undefined;
```

Module format. Required only for an ambiguous `.js` key; inferred from `.mjs`/`.cjs`.

### source

```ts
readonly source: string;
```

Source module to bundle into the file.
