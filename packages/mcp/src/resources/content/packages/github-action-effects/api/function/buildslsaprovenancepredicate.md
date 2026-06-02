---
id: packages/github-action-effects/api/function/buildslsaprovenancepredicate
title: "buildSLSAProvenancePredicate — github-action-effects function"
summary: "Build a SLSA Provenance v1 predicate from OIDC claims + the current runner environment."
tier: packages
source: generated
tags: [github-action-effects, api]
priority: 0.3
related: []
---

# buildSLSAProvenancePredicate

Build a SLSA Provenance v1 predicate from OIDC claims + the current runner environment.

```ts
buildSLSAProvenancePredicate: (claims: OidcClaims, env?: Readonly<Record<string, string | undefined>>) => Effect.Effect<Record<string, unknown>, SlsaError>
```

## Parameters

- `claims` `OidcClaims` — OIDC claims (use [decodeJwtClaims](silk://packages/github-action-effects/api/function/decodejwtclaims) to extract).
- `env` `Readonly<Record<string, string | undefined>>` — Runner environment overrides; defaults to `process.env`.
