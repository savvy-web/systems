---
id: packages/github-action-effects/api/interface/githubartifactmetadatateststate
title: "GitHubArtifactMetadataTestState — github-action-effects interface"
summary: "Test state for `GitHubArtifactMetadata`."
tier: packages
source: generated
tags: [github-action-effects, api]
priority: 0.3
related: []
---

# GitHubArtifactMetadataTestState

Test state for `GitHubArtifactMetadata`.

```ts
interface GitHubArtifactMetadataTestState
```

## Members

### calls

```ts
readonly calls: Array<StorageRecordInput>;
```

Recorded `createStorageRecord` calls.

### recordIds

```ts
readonly recordIds: ReadonlyArray<number>;
```

Record IDs `createStorageRecord` returns.
