---
id: packages/github-action-effects/api/variable/githubtoken
title: "GitHubToken — github-action-effects variable"
summary: "Phase-oriented helpers for the GitHub App installation-token lifecycle: `provision` in `pre`, `client` in `main`, `dispose` in `post`. `read` and `botIdentity`…"
tier: packages
source: generated
tags: [github-action-effects, api]
priority: 0.3
related: []
---

# GitHubToken

Phase-oriented helpers for the GitHub App installation-token lifecycle: `provision` in `pre`, `client` in `main`, `dispose` in `post`. `read` and `botIdentity` surface the persisted token (and a verified commit identity) to any phase after `provision`. `provision` and `dispose` require a `GitHubApp` layer in context — provide `GitHubAppLive` (composed with `OctokitAuthAppLive`) in production, or `GitHubAppTest` in tests. `client`, `read`, and `botIdentity` require `ActionState`.

```ts
GitHubToken: {
    readonly provision: (options?: ProvisionOptions) => Effect.Effect<InstallationToken, GitHubAppError |
  TokenPermissionError | ActionStateError | ConfigError.ConfigError, ActionState |
  GitHubApp | ActionOutputs>;
    readonly client: () => Layer.Layer<GitHubClient, ActionStateError, ActionState>;
    readonly read: () => Effect.Effect<InstallationToken, ActionStateError, ActionState>;
    readonly botIdentity: () => Effect.Effect<BotIdentity, ActionStateError, ActionState>;
    readonly dispose: () => Effect.Effect<void, GitHubAppError |
  ActionStateError, ActionState | GitHubApp>;
}
```
