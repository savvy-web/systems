---
id: packages/github-action-effects/api/variable/actionloglevel
title: "ActionLogLevel — github-action-effects variable"
summary: "The three log levels supported by the action logger. - `info` — Buffered. Shows only outcome summaries. Flushes verbose buffer on failure. - `verbose` — Unbuff…"
tier: packages
source: generated
tags: [github-action-effects, api]
priority: 0.3
related: []
---

# ActionLogLevel

The three log levels supported by the action logger. - `info` — Buffered. Shows only outcome summaries. Flushes verbose buffer on failure. - `verbose` — Unbuffered milestones. Start/finish markers for operations. - `debug` — Everything. Full command output, input/output values, internal state.

```ts
ActionLogLevel: Schema.Literal<["info", "verbose", "debug"]>
```
