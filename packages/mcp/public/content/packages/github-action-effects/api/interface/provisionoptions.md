---
id: packages/github-action-effects/api/interface/provisionoptions
title: "ProvisionOptions — github-action-effects interface"
summary: "Options for GitHubToken."
tier: packages
source: generated
tags: [github-action-effects, api]
priority: 0.3
related: []
---

# ProvisionOptions

Options for [GitHubToken](silk://packages/github-action-effects/api/variable/githubtoken).

```ts
interface ProvisionOptions
```

## Members

### clientId

```ts
readonly clientId?: string;
```

App client ID. Defaults to the `app-client-id` action input.

### installationId

```ts
readonly installationId?: number;
```

Target installation ID. Auto-resolved from the repo owner when omitted.

### permissions

```ts
readonly permissions?: Record<string, PermissionLevel>;
```

When set, the generated token is verified to grant at least these scopes.

### privateKey

```ts
readonly privateKey?: string | Redacted.Redacted<string>;
```

App private key. Defaults to the `app-private-key` action input.
