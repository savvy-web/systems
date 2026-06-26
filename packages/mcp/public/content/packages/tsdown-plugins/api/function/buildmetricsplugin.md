---
id: packages/tsdown-plugins/api/function/buildmetricsplugin
title: "buildMetricsPlugin — tsdown-plugins function"
summary: "Rolldown plugin that records emitted-file metrics into the BuildCollector via writeBundle (which fires for the JS pass AND the emitDtsOnly dts pass — verified…"
tier: packages
source: generated
tags: [tsdown-plugins, api]
priority: 0.3
related: []
---

# buildMetricsPlugin

Rolldown plugin that records emitted-file metrics into the [BuildCollector](silk://packages/tsdown-plugins/api/class/buildcollector) via writeBundle (which fires for the JS pass AND the emitDtsOnly dts pass — verified against tsdown 0.22.3), plus a defensive onLog for rolldown-level diagnostics that bypass tsdown's logger. Append it to each build pass's `plugins` array. `bytes` is taken from the in-memory chunk/asset content (no fs); `gzip` is computed only when `verbose`.

```ts
function buildMetricsPlugin(collector: BuildCollector, groupId: string, pass: PassKind, verbose: boolean): Plugin;
```
