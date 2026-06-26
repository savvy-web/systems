---
id: packages/tsdown-plugins/api/interface/emitmanifestoptions
title: "EmitManifestOptions — tsdown-plugins interface"
summary: "interface EmitManifestOptions from @savvy-web/tsdown-plugins."
tier: packages
source: generated
tags: [tsdown-plugins, api]
priority: 0.3
related: []
---

# EmitManifestOptions

```ts
interface EmitManifestOptions
```

## Members

### devManifest

```ts
readonly devManifest?: "preserve" | "resolve" | undefined;
```

### dual

```ts
readonly dual?: DualExports | undefined;
```

Which exports emit dual import/require conditions. boolean (uniform) or a Set of export keys (per-entry).

### exeRewrite

```ts
readonly exeRewrite?: ExeRewrite | undefined;
```

When set, rewrite exports/bin values equal to the exe source to the SEA path and add it to `files`.

### sourceDir

```ts
readonly sourceDir: string;
```

Source package dir to read package.json/LICENSE/README from.

### subdirExports

```ts
readonly subdirExports?: ReadonlySet<string> | undefined;
```

Export keys built into a `<key>/index.*` subdir (e.g. an RSPress `./runtime`).

### targetGroup

```ts
readonly targetGroup: TargetGroupRef;
```

### transform

```ts
readonly transform?: ((args: {
    pkg: Json;
    targetGroup: TargetGroupRef;
  }) => Json) | undefined;
```
