---
id: packages/github-action-effects/api/interface/pullrequestinfo
title: "PullRequestInfo — github-action-effects interface"
summary: "Information about a pull request."
tier: packages
source: generated
tags: [github-action-effects, api]
priority: 0.3
related: []
---

# PullRequestInfo

Information about a pull request.

```ts
interface PullRequestInfo
```

## Members

### base

```ts
readonly base: string;
```

### baseSha

```ts
readonly baseSha?: string;
```

The base branch's commit SHA.

### body

```ts
readonly body?: string | null;
```

The PR description body; `null` when empty.

### draft

```ts
readonly draft: boolean;
```

### head

```ts
readonly head: string;
```

### mergeCommitSha

```ts
readonly mergeCommitSha?: string | null;
```

SHA of the merge commit; `null` when not merged.

### merged

```ts
readonly merged: boolean;
```

### mergedAt

```ts
readonly mergedAt?: string | null;
```

ISO-8601 merge timestamp; `null` when not merged, absent from test fixtures that do not set it.

### nodeId

```ts
readonly nodeId: string;
```

### number

```ts
readonly number: number;
```

### state

```ts
readonly state: "open" | "closed";
```

### title

```ts
readonly title: string;
```

### url

```ts
readonly url: string;
```
