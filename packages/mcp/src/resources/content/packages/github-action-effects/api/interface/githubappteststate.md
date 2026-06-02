---
id: packages/github-action-effects/api/interface/githubappteststate
title: "GitHubAppTestState — github-action-effects interface"
summary: "Test state for GitHubApp."
tier: packages
source: generated
tags: [github-action-effects, api]
priority: 0.3
related: []
---

# GitHubAppTestState

Test state for [GitHubApp](silk://packages/github-action-effects/api/class/githubapp).

```ts
interface GitHubAppTestState
```

## Members

### appIdentity

```ts
readonly appIdentity?: {
        appSlug: string;
        appUserId: number;
        appName: string;
    };
```

Identity returned by `resolveAppIdentity`. When omitted, `resolveAppIdentity` fails — exercising `provision`'s best-effort degradation path.

### generateCalls

```ts
readonly generateCalls: Array<{
        appId: string;
        privateKey: Redacted.Redacted<string>;
        installationId?: number;
    }>;
```

### revokeCalls

```ts
readonly revokeCalls: Array<Redacted.Redacted<string>>;
```

### tokenToReturn

```ts
readonly tokenToReturn: InstallationToken;
```
