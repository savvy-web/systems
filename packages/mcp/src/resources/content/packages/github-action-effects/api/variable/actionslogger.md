---
id: packages/github-action-effects/api/variable/actionslogger
title: "ActionsLogger — github-action-effects variable"
summary: "An Effect `Logger` that maps log levels to GitHub Actions workflow commands. - Debug / Trace → `::debug::message` - Info → plain text to stdout (no command pre…"
tier: packages
source: generated
tags: [github-action-effects, api]
priority: 0.3
related: []
---

# ActionsLogger

An Effect `Logger` that maps log levels to GitHub Actions workflow commands. - Debug / Trace → `::debug::message` - Info → plain text to stdout (no command prefix) - Warning → `::warning::message` - Error / Fatal → `::error::message` Annotations `file`, `line`, and `col` are forwarded as workflow command properties when present (e.g. `::error file=a.ts,line=1::message`).

```ts
ActionsLogger: Logger.Logger<unknown, void>
```
