---
id: packages/github-action-effects/api/class/slsaerror
title: "SlsaError — github-action-effects class"
summary: "Error raised by SLSA helpers. - `\"decode\"` — JWT payload could not be decoded - `\"claims\"` — decoded JWT is missing required claims - `\"env\"` — predicate could…"
tier: packages
source: generated
tags: [github-action-effects, api]
priority: 0.3
related: []
---

# SlsaError

Error raised by SLSA helpers. - `"decode"` — JWT payload could not be decoded - `"claims"` — decoded JWT is missing required claims - `"env"` — predicate could not be assembled from the runner environment

```ts
class SlsaError extends SlsaError_base<{
  readonly reason: "decode" | "claims" | "env";
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
readonly reason: "decode" | "claims" | "env";
```
