---
id: packages/github-action-effects/api/function/buildstatement
title: "buildStatement — github-action-effects function"
summary: "Build a InTotoStatement from a list of subjects and a typed predicate."
tier: packages
source: generated
tags: [github-action-effects, api]
priority: 0.3
related: []
---

# buildStatement

Build a [InTotoStatement](silk://packages/github-action-effects/api/class/intotostatement) from a list of subjects and a typed predicate.

```ts
buildStatement: (input: AttestInput) => InTotoStatement
```

## Examples

```ts
const stmt = buildStatement({
  subjects: [{ name: "pkg:npm/@scope/pkg@1.0.0", digest: { sha256: "..." } }],
  predicateType: SLSA_PROVENANCE_V1,
  predicate: { buildDefinition: ..., runDetails: ... },
})

```
