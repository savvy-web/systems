---
"@savvy-web/github-action-effects": minor
---

## Features

### BlobStore service

Adds a generic `BlobStore` service — a key-to-bytes store abstraction for caching binary blobs across workflow steps. Exposes `get(key)` returning `Option<Uint8Array>`, `put(key, bytes)`, and `has(key)` so consumers work against a uniform interface regardless of the backend.

- `BlobStore` — service tag and interface
- `BlobStoreError` — typed error for all BlobStore failures

### GitHubBlobStoreLive backend

Implements `BlobStore` on top of the GitHub Actions V2 cache protocol (the same Twirp + Azure Blob transport `ActionCache` uses), storing each blob as its own cache entry keyed by the provided blob key.

- `GitHubBlobStoreLive` — layer requiring `HttpClient`

### S3BlobStoreLive backend

Implements `BlobStore` on top of any S3-compatible object storage endpoint (AWS S3, R2, MinIO, Spaces) using path-style addressing. Requests are authenticated with a hand-rolled AWS SigV4 signer — no `aws-sdk` dependency. `get` issues a signed GET (a 404 maps to `Option.none()`), `has` a signed HEAD, and `put` a signed PUT.

- `S3BlobStoreLive` — layer requiring `HttpClient`, configured via `S3BlobStoreConfig`
- `S3BlobStoreConfig` — `bucket`, `region`, optional `endpoint`, `accessKeyId`, `secretAccessKey`, optional `sessionToken`, optional `prefix`. Secret material is held as `Redacted` and unwrapped only inside the signer.

### BlobStoreTest layer

Provides an in-memory `BlobStore` implementation for unit tests with observable state.

- `BlobStoreTest` — test layer backed by an in-memory `Map`
- `BlobStoreTestState` — type for introspecting stored blobs in tests
