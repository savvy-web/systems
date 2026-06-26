---
id: packages/github-action-effects/api/interface/attestationrecord
title: "AttestationRecord — github-action-effects interface"
summary: "Result of a successful end-to-end attestation: the statement, the signed Sigstore bundle, and the GitHub attestation record."
tier: packages
source: generated
tags: [github-action-effects, api]
priority: 0.3
related: []
---

# AttestationRecord

Result of a successful end-to-end attestation: the statement, the signed Sigstore bundle, and the GitHub attestation record.

```ts
interface AttestationRecord
```

## Members

### attestationId

```ts
readonly attestationId: number;
```

### attestationUrl

```ts
readonly attestationUrl: string;
```

### bundle

```ts
readonly bundle: SigstoreBundle;
```

### statement

```ts
readonly statement: InTotoStatement;
```
