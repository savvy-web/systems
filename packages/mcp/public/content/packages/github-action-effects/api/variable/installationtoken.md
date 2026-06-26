---
id: packages/github-action-effects/api/variable/installationtoken
title: "InstallationToken — github-action-effects variable"
summary: "An installation token generated from a GitHub App."
tier: packages
source: generated
tags: [github-action-effects, api]
priority: 0.3
related: []
---

# InstallationToken

An installation token generated from a GitHub App.

```ts
InstallationToken: Schema.Struct<{
  token: Schema.Redacted<typeof Schema.String>;
  expiresAt: typeof Schema.String;
  installationId: typeof Schema.Number;
  appSlug: Schema.optional<typeof Schema.String>;
  appUserId: Schema.optional<typeof Schema.Number>;
  appName: Schema.optional<typeof Schema.String>;
  permissions: Schema.optionalWith<Schema.Record$<typeof Schema.String, typeof Schema.String>, {
    default: () => {};
  }>;
}>
```
