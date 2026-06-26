---
id: packages/tsdown-plugins/api/interface/exetarget
title: "ExeTarget — tsdown-plugins interface"
summary: "A resolved per-platform SEA target. `platform` uses the tsdown/tsdown/exe token (win, not win32)."
tier: packages
source: generated
tags: [tsdown-plugins, api]
priority: 0.3
related: []
---

# ExeTarget

A resolved per-platform SEA target. `platform` uses the tsdown/tsdown/exe token (win, not win32).

```ts
interface ExeTarget
```

## Members

### arch

```ts
readonly arch: "arm64" | "x64";
```

### nodeVersion

```ts
readonly nodeVersion: string;
```

### platform

```ts
readonly platform: "darwin" | "linux" | "win";
```
