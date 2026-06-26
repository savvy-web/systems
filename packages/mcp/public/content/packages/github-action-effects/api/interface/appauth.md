---
id: packages/github-action-effects/api/interface/appauth
title: "AppAuth — github-action-effects interface"
summary: "Auth function returned by `createAppAuth`."
tier: packages
source: generated
tags: [github-action-effects, api]
priority: 0.3
related: []
---

# AppAuth

Auth function returned by `createAppAuth`.

```ts
interface AppAuth
```

## Members

### (call)

```ts
(options: {
    type: "app";
  }): Promise<{
    token: string;
  }>;
```

### (call)

```ts
(options: {
    type: "installation";
    installationId: number;
  }): Promise<{
    token: string;
    expiresAt: string;
    installationId: number;
    permissions: Record<string, string>;
  }>;
```
