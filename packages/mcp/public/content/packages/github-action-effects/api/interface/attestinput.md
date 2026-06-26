---
id: packages/github-action-effects/api/interface/attestinput
title: "AttestInput — github-action-effects interface"
summary: "Common input for any attestation operation."
tier: packages
source: generated
tags: [github-action-effects, api]
priority: 0.3
related: []
---

# AttestInput

Common input for any attestation operation.

```ts
interface AttestInput
```

## Members

### predicate

```ts
readonly predicate: unknown;
```

### predicateType

```ts
readonly predicateType: string;
```

### subjects

```ts
readonly subjects: ReadonlyArray<InTotoSubject>;
```
