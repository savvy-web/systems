---
id: packages/github-action-effects/api/interface/attestationlistentry
title: "AttestationListEntry — github-action-effects interface"
summary: "One entry in the Attest result."
tier: packages
source: generated
tags: [github-action-effects, api]
priority: 0.3
related: []
---

# AttestationListEntry

One entry in the [Attest](silk://packages/github-action-effects/api/class/attest) result.

```ts
interface AttestationListEntry
```

## Members

### attestationUrl

```ts
readonly attestationUrl: string;
```

GitHub UI URL for the attestation (`/{owner}/{repo}/attestations/{id}`).

### predicateType

```ts
readonly predicateType: string;
```

Predicate type URI carried by the in-toto statement inside the bundle.
