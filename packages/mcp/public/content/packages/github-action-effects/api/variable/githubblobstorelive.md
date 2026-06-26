---
id: packages/github-action-effects/api/variable/githubblobstorelive
title: "GitHubBlobStoreLive — github-action-effects variable"
summary: "Live implementation of BlobStore backed by the GitHub Actions V2 Twirp cache protocol and Azure Blob Storage. Unlike ActionCacheLive (which tars a path-set bef…"
tier: packages
source: generated
tags: [github-action-effects, api]
priority: 0.3
related: []
---

# GitHubBlobStoreLive

Live implementation of [BlobStore](silk://packages/github-action-effects/api/class/blobstore) backed by the GitHub Actions V2 Twirp cache protocol and Azure Blob Storage. Unlike [ActionCacheLive](silk://packages/github-action-effects/api/variable/actioncachelive) (which tars a path-set before uploading), this layer uploads/downloads raw in-memory byte buffers — one key per blob. The version hash is a constant (`BLOB_VERSION`) rather than being derived from paths, so any caller-supplied key maps to a unique, reproducible slot. Requires `HttpClient.HttpClient` for the Twirp RPCs; `ActionsRuntime.Default` / `Action.run` provides it via `FetchHttpClient.layer`. Manual-wiring consumers must provide it themselves.

```ts
GitHubBlobStoreLive: Layer.Layer<BlobStore, never, HttpClient.HttpClient>
```
