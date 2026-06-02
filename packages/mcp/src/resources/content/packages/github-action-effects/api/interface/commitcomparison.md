---
id: packages/github-action-effects/api/interface/commitcomparison
title: "CommitComparison — github-action-effects interface"
summary: "Result of comparing two commits/refs (base...head)."
tier: packages
source: generated
tags: [github-action-effects, api]
priority: 0.3
related: []
---

# CommitComparison

Result of comparing two commits/refs (base...head).

```ts
interface CommitComparison
```

## Members

### commits

```ts
readonly commits: ReadonlyArray<CommitSummary>;
```

### files

```ts
readonly files: ReadonlyArray<CommitFile>;
```
