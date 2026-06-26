---
id: packages/github-action-effects/api/function/s3blobstorelive
title: "S3BlobStoreLive — github-action-effects function"
summary: "An S3-backed BlobStore using path-style addressing and SigV4. Works with AWS S3 and S3-compatible stores (R2, MinIO, Spaces) via `endpoint`."
tier: packages
source: generated
tags: [github-action-effects, api]
priority: 0.3
related: []
---

# S3BlobStoreLive

An S3-backed [BlobStore](silk://packages/github-action-effects/api/class/blobstore) using path-style addressing and SigV4. Works with AWS S3 and S3-compatible stores (R2, MinIO, Spaces) via `endpoint`.

```ts
S3BlobStoreLive: (config: S3BlobStoreConfig) => Layer.Layer<BlobStore, never, HttpClient.HttpClient>
```
