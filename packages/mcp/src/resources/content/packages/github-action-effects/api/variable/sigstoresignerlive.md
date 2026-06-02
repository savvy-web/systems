---
id: packages/github-action-effects/api/variable/sigstoresignerlive
title: "SigstoreSignerLive — github-action-effects variable"
summary: "Live SigstoreSigner layer using the public-good Sigstore instance (Fulcio + Rekor). Requires OidcTokenIssuer to be provided downstream."
tier: packages
source: generated
tags: [github-action-effects, api]
priority: 0.3
related: []
---

# SigstoreSignerLive

Live [SigstoreSigner](silk://packages/github-action-effects/api/class/sigstoresigner) layer using the public-good Sigstore instance (Fulcio + Rekor). Requires [OidcTokenIssuer](silk://packages/github-action-effects/api/class/oidctokenissuer) to be provided downstream.

```ts
SigstoreSignerLive: Layer.Layer<SigstoreSigner, never, never>
```
