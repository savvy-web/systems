---
id: packages/github-action-effects/api/interface/polloptions
title: "PollOptions — github-action-effects interface"
summary: "Options for polling a dispatched workflow run."
tier: packages
source: generated
tags: [github-action-effects, api]
priority: 0.3
related: []
---

# PollOptions

Options for polling a dispatched workflow run.

```ts
interface PollOptions
```

## Members

### intervalMs

```ts
readonly intervalMs?: number;
```

Polling interval in milliseconds. Default: 10000 (10s).

### timeoutMs

```ts
readonly timeoutMs?: number;
```

Timeout in milliseconds. Default: 300000 (5min).
