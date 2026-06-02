---
id: packages/github-action-effects/api/interface/provenanceattestationinput
title: "ProvenanceAttestationInput — github-action-effects interface"
summary: "Input for Attest."
tier: packages
source: generated
tags: [github-action-effects, api]
priority: 0.3
related: []
---

# ProvenanceAttestationInput

Input for [Attest](silk://packages/github-action-effects/api/class/attest).

```ts
interface ProvenanceAttestationInput
```

## Members

### predicate

```ts
readonly predicate: unknown;
```

SLSA Provenance v1 predicate (build-definition + run-details).

### subjectName

```ts
readonly subjectName: string;
```

PURL or other in-toto [subject](silk://packages/github-action-effects/api/function/subject) name (e.g. `pkg:npm/@scope/pkg@1.0.0`).

### subjectSha256

```ts
readonly subjectSha256: string;
```

Hex-encoded SHA-256 of the artifact.
