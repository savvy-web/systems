---
id: packages/github-action-effects/api/function/decodejwtclaims
title: "decodeJwtClaims — github-action-effects function"
summary: "Decode a JWT payload without verifying its signature."
tier: packages
source: generated
tags: [github-action-effects, api]
priority: 0.3
related: []
---

# decodeJwtClaims

Decode a JWT payload without verifying its signature.

```ts
decodeJwtClaims: (token: string) => Effect.Effect<OidcClaims, SlsaError>
```
