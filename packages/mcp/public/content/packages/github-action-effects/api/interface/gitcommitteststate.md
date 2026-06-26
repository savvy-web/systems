---
id: packages/github-action-effects/api/interface/gitcommitteststate
title: "GitCommitTestState — github-action-effects interface"
summary: "Test state for GitCommit."
tier: packages
source: generated
tags: [github-action-effects, api]
priority: 0.3
related: []
---

# GitCommitTestState

Test state for [GitCommit](silk://packages/github-action-effects/api/class/gitcommit).

```ts
interface GitCommitTestState
```

## Members

### commits

```ts
readonly commits: Array<{
    message: string;
    treeSha: string;
    parentShas: Array<string>;
    sha: string;
  }>;
```

### refUpdates

```ts
readonly refUpdates: Array<{
    ref: string;
    sha: string;
    force?: boolean;
  }>;
```

### trees

```ts
readonly trees: Array<{
    entries: Array<TreeEntry>;
    baseTree?: string;
    sha: string;
  }>;
```
