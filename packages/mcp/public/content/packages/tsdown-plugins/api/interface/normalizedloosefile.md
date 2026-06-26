---
id: packages/tsdown-plugins/api/interface/normalizedloosefile
title: "NormalizedLooseFile — tsdown-plugins interface"
summary: "A loose file resolved to a concrete build descriptor."
tier: packages
source: generated
tags: [tsdown-plugins, api]
priority: 0.3
related: []
---

# NormalizedLooseFile

A loose file resolved to a concrete build descriptor.

```ts
interface NormalizedLooseFile
```

## Members

### entryName

```ts
readonly entryName: string;
```

tsdown entry name (outFile without its extension), e.g. `pnpmfile`.

### fixedExtension

```ts
readonly fixedExtension: boolean;
```

Whether tsdown should use fixed extensions. `.mjs`/`.cjs` need `true` (tsdown derives `.mjs` for esm and `.cjs` for cjs); a `.js` + esm output needs `false` (tsdown derives `.js`).

### format

```ts
readonly format: BuildFormat;
```

Resolved module format.

### outFile

```ts
readonly outFile: string;
```

Literal output filename written into the package dir, e.g. `pnpmfile.mjs`.

### source

```ts
readonly source: string;
```

Source module to bundle.
