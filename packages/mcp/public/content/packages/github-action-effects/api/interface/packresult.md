---
id: packages/github-action-effects/api/interface/packresult
title: "PackResult — github-action-effects interface"
summary: "Result of packing a package directory into a tarball."
tier: packages
source: generated
tags: [github-action-effects, api]
priority: 0.3
related: []
---

# PackResult

Result of packing a package directory into a tarball.

```ts
interface PackResult
```

## Members

### digest

```ts
readonly digest: string;
```

Integrity digest of the tarball, in npm's `dist.integrity` format (`sha512-<base64>`). Sourced from `npm pack --json`'s emitted `integrity` field rather than recomputed locally so the value matches byte-for-byte what the registry would store.

### fileCount

```ts
readonly fileCount: number;
```

File count in the tarball (`entryCount` from `npm pack --json`).

### name

```ts
readonly name: string;
```

Package name as reported by `npm pack --json`.

### packedSize

```ts
readonly packedSize: number;
```

Tarball size on disk, in bytes (`size` from `npm pack --json`).

### sha256Hex

```ts
readonly sha256Hex: string;
```

SHA-256 of the tarball, as a lowercase hex string (no `sha256:` prefix). Computed locally from `tarballPath`. This is the digest format the GitHub artifact-metadata and attestation APIs accept as the [subject](silk://packages/github-action-effects/api/function/subject). It is NOT interchangeable with `digest`: different algorithm, different encoding.

### tarballPath

```ts
readonly tarballPath: string;
```

Absolute path to the packed tarball on disk.

### unpackedSize

```ts
readonly unpackedSize: number;
```

Unpacked package size in bytes (`unpackedSize` from `npm pack --json`).

### version

```ts
readonly version: string;
```

Package version as reported by `npm pack --json`.
