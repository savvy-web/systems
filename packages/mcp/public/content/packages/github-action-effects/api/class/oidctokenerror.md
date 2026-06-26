---
id: packages/github-action-effects/api/class/oidctokenerror
title: "OidcTokenError — github-action-effects class"
summary: "Errors raised by OidcTokenIssuer. - `\"env\"` — required `ACTIONS_ID_TOKEN_REQUEST_*` env var missing - `\"http\"` — non-2xx response or transport error from the t…"
tier: packages
source: generated
tags: [github-action-effects, api]
priority: 0.3
related: []
---

# OidcTokenError

Errors raised by [OidcTokenIssuer](silk://packages/github-action-effects/api/class/oidctokenissuer). - `"env"` — required `ACTIONS_ID_TOKEN_REQUEST_*` env var missing - `"http"` — non-2xx response or transport error from the token service - `"decode"` — token service returned a payload without a `value` field - `"save"` — failure writing the redacted token to disk

```ts
class OidcTokenError extends OidcTokenError_base<{
  readonly reason: "env" | "http" | "decode" | "save";
  readonly message: string;
  readonly cause?: unknown;
}>
```

## Members

### cause

```ts
readonly cause?: unknown;
```

### message

```ts
readonly message: string;
```

### reason

```ts
readonly reason: "env" | "http" | "decode" | "save";
```
