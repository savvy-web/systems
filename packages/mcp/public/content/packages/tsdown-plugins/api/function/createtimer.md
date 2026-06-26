---
id: packages/tsdown-plugins/api/function/createtimer
title: "createTimer — tsdown-plugins function"
summary: "Create a wall-clock timer. (Date.now is fine in runtime build code.)"
tier: packages
source: generated
tags: [tsdown-plugins, api]
priority: 0.3
related: []
---

# createTimer

Create a wall-clock timer. (Date.now is fine in runtime build code.)

```ts
function createTimer(now?: () => number): Timer;
```
