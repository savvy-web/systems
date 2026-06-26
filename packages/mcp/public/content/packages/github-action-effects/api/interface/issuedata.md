---
id: packages/github-action-effects/api/interface/issuedata
title: "IssueData — github-action-effects interface"
summary: "Data returned from a GitHub issue."
tier: packages
source: generated
tags: [github-action-effects, api]
priority: 0.3
related: []
---

# IssueData

Data returned from a GitHub issue.

```ts
interface IssueData
```

## Members

### htmlUrl

```ts
readonly htmlUrl?: string;
```

The issue's HTML URL.

### labels

```ts
readonly labels: Array<string>;
```

### nodeId

```ts
readonly nodeId?: string;
```

The issue's GraphQL node id.

### number

```ts
readonly number: number;
```

### state

```ts
readonly state: string;
```

### title

```ts
readonly title: string;
```
