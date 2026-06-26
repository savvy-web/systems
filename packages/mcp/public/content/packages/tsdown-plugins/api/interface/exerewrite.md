---
id: packages/tsdown-plugins/api/interface/exerewrite
title: "ExeRewrite — tsdown-plugins interface"
summary: "Describes a SEA binary the bundler compiled for this package. When present, transformManifest rewrites every `exports`/`bin` value equal to `source` to the emi…"
tier: packages
source: generated
tags: [tsdown-plugins, api]
priority: 0.3
related: []
---

# ExeRewrite

Describes a SEA binary the bundler compiled for this package. When present, [transformManifest](silk://packages/tsdown-plugins/api/function/transformmanifest) rewrites every `exports`/`bin` value equal to `source` to the emitted binary path and adds it to `files` so it ships in the tarball.

```ts
interface ExeRewrite
```

## Members

### dir

```ts
readonly dir: string;
```

Relative dir the binary is emitted into (e.g. "bin").

### fileName

```ts
readonly fileName: string;
```

The emitted SEA filename (already suffixed, incl. .exe on win).

### source

```ts
readonly source: string;
```

The exe entry source path (matches exports/bin values to rewrite).
