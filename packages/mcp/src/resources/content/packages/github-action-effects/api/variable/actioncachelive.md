---
id: packages/github-action-effects/api/variable/actioncachelive
title: "ActionCacheLive — github-action-effects variable"
summary: "Live implementation of ActionCache using the V2 Twirp cache protocol and Azure Blob Storage for uploads/downloads. Requires HttpClient for the Twirp RPCs; the…"
tier: packages
source: generated
tags: [github-action-effects, api]
priority: 0.3
related: []
---

# ActionCacheLive

Live implementation of [ActionCache](silk://packages/github-action-effects/api/class/actioncache) using the V2 Twirp cache protocol and Azure Blob Storage for uploads/downloads. Requires HttpClient for the Twirp RPCs; the `ActionsRuntime.Default` / `Action.run` path provides it via `FetchHttpClient.layer`. Manual-wiring consumers must provide it themselves.

```ts
ActionCacheLive: Layer.Layer<ActionCache, never, HttpClient.HttpClient>
```
