---
id: packages/github-action-effects/api/variable/actionloggerlive
title: "ActionLoggerLive — github-action-effects variable"
summary: "Live implementation of the ActionLogger service. Has no external dependencies — uses WorkflowCommand to write group markers directly to stdout and Effect's Log…"
tier: packages
source: generated
tags: [github-action-effects, api]
priority: 0.3
related: []
---

# ActionLoggerLive

Live implementation of the [ActionLogger](silk://packages/github-action-effects/api/class/actionlogger) service. Has no external dependencies — uses WorkflowCommand to write group markers directly to stdout and Effect's Logger API for buffering.

```ts
ActionLoggerLive: Layer.Layer<ActionLogger>
```
