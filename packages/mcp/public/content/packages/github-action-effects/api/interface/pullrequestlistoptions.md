---
id: packages/github-action-effects/api/interface/pullrequestlistoptions
title: "PullRequestListOptions — github-action-effects interface"
summary: "Options for listing pull requests."
tier: packages
source: generated
tags: [github-action-effects, api]
priority: 0.3
related: []
---

# PullRequestListOptions

Options for listing pull requests.

```ts
interface PullRequestListOptions
```

## Members

### base

```ts
readonly base?: string;
```

Filter by base branch.

### head

```ts
readonly head?: string;
```

Filter by head branch (e.g. "owner:branch" or just "branch").

### paginate

```ts
readonly paginate?: boolean;
```

When true, fetches all pages. Defaults to false.

### perPage

```ts
readonly perPage?: number;
```

Results per page. Defaults to 30.

### state

```ts
readonly state?: "open" | "closed" | "all";
```

Filter by state. Defaults to "open".
