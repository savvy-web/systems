---
id: packages/github-action-effects/api/interface/dryrunresult
title: "DryRunResult — github-action-effects interface"
summary: "Outcome of a `npm publish --dry-run`."
tier: packages
source: generated
tags: [github-action-effects, api]
priority: 0.3
related: []
---

# DryRunResult

Outcome of a `npm publish --dry-run`.

```ts
interface DryRunResult
```

## Members

### fileCount

```ts
readonly fileCount?: number;
```

File count in the tarball, when npm reported it.

### ok

```ts
readonly ok: boolean;
```

`true` when `npm publish --dry-run` exited cleanly — the package would publish.

### output

```ts
readonly output: string;
```

Raw npm output (stdout on success, stderr/​reason on failure) — for diagnostics.

### packedSize

```ts
readonly packedSize?: number;
```

Packed tarball size in bytes, when npm reported it.

### unpackedSize

```ts
readonly unpackedSize?: number;
```

Unpacked size in bytes, when npm reported it.
