---
id: packages/github-action-effects/api/class/blobstore
title: "BlobStore — github-action-effects class"
summary: "A generic content-addressable key/value blob store. Backends store raw bytes under an arbitrary string key. Unlike ActionCache (which tars a path-set under one…"
tier: packages
source: generated
tags: [github-action-effects, api]
priority: 0.3
related: []
---

# BlobStore

A generic content-addressable key/value blob store. Backends store raw bytes under an arbitrary string key. Unlike [ActionCache](silk://packages/github-action-effects/api/class/actioncache) (which tars a path-set under one key), this stores a single byte buffer per key, suitable for per-artifact remote caching.

```ts
class BlobStore extends BlobStore_base
```
