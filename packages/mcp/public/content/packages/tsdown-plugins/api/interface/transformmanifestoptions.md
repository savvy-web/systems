---
id: packages/tsdown-plugins/api/interface/transformmanifestoptions
title: "TransformManifestOptions — tsdown-plugins interface"
summary: "interface TransformManifestOptions from @savvy-web/tsdown-plugins."
tier: packages
source: generated
tags: [tsdown-plugins, api]
priority: 0.3
related: []
---

# TransformManifestOptions

```ts
interface TransformManifestOptions
```

## Members

### dual

```ts
readonly dual?: DualExports | undefined;
```

Which exports emit dual import/require conditions. boolean = uniform; Set = per-export-key.

### exeRewrite

```ts
readonly exeRewrite?: ExeRewrite | undefined;
```

When set, rewrite exports/bin values equal to `source` to the SEA path and add it to `files`.

### subdirExports

```ts
readonly subdirExports?: ReadonlySet<string> | undefined;
```

Export keys built into a `<key>/index.*` subdir (e.g. an RSPress `./runtime`).

### transform

```ts
readonly transform?: ((pkg: Json) => Json) | undefined;
```

Run after the standard transforms, before the bin final-guard + sort.
