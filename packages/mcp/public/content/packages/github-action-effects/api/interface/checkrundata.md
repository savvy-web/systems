---
id: packages/github-action-effects/api/interface/checkrundata
title: "CheckRunData — github-action-effects interface"
summary: "Data describing a check run."
tier: packages
source: generated
tags: [github-action-effects, api]
priority: 0.3
related: []
---

# CheckRunData

Data describing a check run.

```ts
interface CheckRunData
```

## Members

### conclusion

```ts
readonly conclusion: CheckRunConclusion | null;
```

### htmlUrl

```ts
readonly htmlUrl: string;
```

### id

```ts
readonly id: number;
```

### name

```ts
readonly name: string;
```

### status

```ts
readonly status: "queued" | "in_progress" | "completed";
```
