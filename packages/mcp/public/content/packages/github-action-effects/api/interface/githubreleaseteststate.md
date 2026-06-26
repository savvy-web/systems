---
id: packages/github-action-effects/api/interface/githubreleaseteststate
title: "GitHubReleaseTestState — github-action-effects interface"
summary: "Test state for GitHubRelease."
tier: packages
source: generated
tags: [github-action-effects, api]
priority: 0.3
related: []
---

# GitHubReleaseTestState

Test state for [GitHubRelease](silk://packages/github-action-effects/api/class/githubrelease).

```ts
interface GitHubReleaseTestState
```

## Members

### assets

```ts
readonly assets: Map<number, Array<ReleaseAsset>>;
```

Assets per release id — populated by uploadAsset, read by listReleaseAssets.

### createCalls

```ts
readonly createCalls: Array<{
    tag: string;
    name: string;
  }>;
```

### releases

```ts
readonly releases: Map<string, ReleaseData>;
```

### uploadCalls

```ts
readonly uploadCalls: Array<{
    releaseId: number;
    name: string;
  }>;
```
