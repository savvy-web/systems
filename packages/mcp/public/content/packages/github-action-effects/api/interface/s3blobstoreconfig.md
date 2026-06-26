---
id: packages/github-action-effects/api/interface/s3blobstoreconfig
title: "S3BlobStoreConfig — github-action-effects interface"
summary: "Configuration for an S3-backed BlobStore. Secret material is held as `Redacted` so it cannot be accidentally logged; it is unwrapped only inside the request si…"
tier: packages
source: generated
tags: [github-action-effects, api]
priority: 0.3
related: []
---

# S3BlobStoreConfig

Configuration for an S3-backed [BlobStore](silk://packages/github-action-effects/api/class/blobstore). Secret material is held as `Redacted` so it cannot be accidentally logged; it is unwrapped only inside the request signer.

```ts
interface S3BlobStoreConfig
```

## Members

### accessKeyId

```ts
readonly accessKeyId: string;
```

### bucket

```ts
readonly bucket: string;
```

### endpoint

```ts
readonly endpoint?: string;
```

### prefix

```ts
readonly prefix?: string;
```

### region

```ts
readonly region: string;
```

### secretAccessKey

```ts
readonly secretAccessKey: Redacted.Redacted<string>;
```

### sessionToken

```ts
readonly sessionToken?: Redacted.Redacted<string>;
```
