---
id: packages/tsdown-plugins/api/function/resolvejsxconfig
title: "resolveJsxConfig — tsdown-plugins function"
summary: "Resolve the effective JSX config: an explicit override wins; otherwise infer from the tsconfig values. Returns undefined when no JSX transform is needed (prese…"
tier: packages
source: generated
tags: [tsdown-plugins, api]
priority: 0.3
related: []
---

# resolveJsxConfig

Resolve the effective JSX config: an explicit override wins; otherwise infer from the tsconfig values. Returns undefined when no JSX transform is needed (preserve/none).

```ts
function resolveJsxConfig(tsconfig: TsconfigJsx, override: JsxConfig | undefined): JsxConfig | undefined;
```
