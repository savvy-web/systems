---
id: packages/github-action-effects/api/function/savetoken
title: "saveToken — github-action-effects function"
summary: "Save the redacted OIDC token to disk for local inspection."
tier: packages
source: generated
tags: [github-action-effects, api]
priority: 0.3
related: []
---

# saveToken

Save the redacted OIDC token to disk for local inspection.

```ts
saveToken: (token: Redacted.Redacted<string>, path: string) => Effect.Effect<void, OidcTokenError, FileSystem.FileSystem>
```
