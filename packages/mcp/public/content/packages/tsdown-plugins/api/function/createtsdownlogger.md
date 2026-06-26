---
id: packages/tsdown-plugins/api/function/createtsdownlogger
title: "createTsdownLogger — tsdown-plugins function"
summary: "A tsdown `customLogger` that routes warnings/errors into the BuildCollector instead of the console. Paired with `logLevel: \"silent\"` in the same build config:…"
tier: packages
source: generated
tags: [tsdown-plugins, api]
priority: 0.3
related: []
---

# createTsdownLogger

A tsdown `customLogger` that routes warnings/errors into the [BuildCollector](silk://packages/tsdown-plugins/api/class/buildcollector) instead of the console. Paired with `logLevel: "silent"` in the same build config: silent suppresses tsdown's own console output while this logger still receives every message (verified against tsdown 0.22.3). info/success are dropped — file metrics come from the writeBundle plugin and timing from our timer.

```ts
function createTsdownLogger(collector: BuildCollector, groupId: string): TsdownLogger;
```
