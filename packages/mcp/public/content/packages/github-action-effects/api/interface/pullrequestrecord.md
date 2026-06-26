---
id: packages/github-action-effects/api/interface/pullrequestrecord
title: "PullRequestRecord — github-action-effects interface"
summary: "Recorded pull request for testing."
tier: packages
source: generated
tags: [github-action-effects, api]
priority: 0.3
related: []
---

# PullRequestRecord

Recorded pull request for testing.

```ts
interface PullRequestRecord extends PullRequestInfo
```

## Members

### autoMerge

```ts
autoMerge: "merge" | "squash" | "rebase" | false | undefined;
```

### body

```ts
body: string | null;
```

### labels

```ts
readonly labels: Array<string>;
```

### merged

```ts
merged: boolean;
```

Mutable for test updates.

### reviewers

```ts
readonly reviewers: Array<string>;
```

### state

```ts
state: "open" | "closed";
```

Mutable for test updates.

### teamReviewers

```ts
readonly teamReviewers: Array<string>;
```

### title

```ts
title: string;
```

Mutable for test updates.
