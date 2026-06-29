---
id: packages/rspress-builder/api/function/build
title: "build — rspress-builder function"
summary: "Front door for building an RSPress plugin. Applies the definePlugin preset and runs the build, deriving `cwd` and `argv` from `process.argv`. For advanced use,…"
tier: packages
source: generated
tags: [rspress-builder, api]
priority: 0.3
related: []
---

# build

Front door for building an RSPress plugin. Applies the [definePlugin](silk://packages/rspress-builder/api/function/defineplugin) preset and runs the [build](silk://packages/rspress-builder/api/function/build), deriving `cwd` and `argv` from `process.argv`. For advanced use, [definePlugin](silk://packages/rspress-builder/api/function/defineplugin) and `runBuild` remain exported.

```ts
function build(options?: RspressPluginOptions, overrides?: Partial<RunOptions>): Promise<void>;
```
