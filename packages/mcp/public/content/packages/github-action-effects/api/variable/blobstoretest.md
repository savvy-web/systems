---
id: packages/github-action-effects/api/variable/blobstoretest
title: "BlobStoreTest — github-action-effects variable"
summary: "Test implementation for BlobStore."
tier: packages
source: generated
tags: [github-action-effects, api]
priority: 0.3
related: []
---

# BlobStoreTest

Test implementation for [BlobStore](silk://packages/github-action-effects/api/class/blobstore).

```ts
BlobStoreTest: {
  readonly empty: () => BlobStoreTestState; /** Create a test layer from the given state. */
  readonly layer: (state: BlobStoreTestState) => Layer.Layer<BlobStore>;
}
```
