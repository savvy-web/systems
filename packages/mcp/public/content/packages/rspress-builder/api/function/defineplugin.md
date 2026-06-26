---
id: packages/rspress-builder/api/function/defineplugin
title: "definePlugin — rspress-builder function"
summary: "Build an RSPress plugin package: a Node plugin entry (`.`) plus a browser, bundleless, CSS-module React runtime entry (`./runtime`). Returns a standard `BuildC…"
tier: packages
source: generated
tags: [rspress-builder, api]
priority: 0.3
related: []
---

# definePlugin

Build an RSPress plugin package: a Node plugin entry (`.`) plus a browser, bundleless, CSS-module React runtime entry (`./runtime`). Returns a standard `BuildConfig`; hand it to `runBuild` from a self-executing `savvy.build.ts`.

```ts
function definePlugin(options?: RspressPluginOptions): BuildConfig;
```
