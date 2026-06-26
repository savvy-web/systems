---
id: packages/github-action-effects/api/interface/checkrunrecord
title: "CheckRunRecord — github-action-effects interface"
summary: "Recorded check run for testing."
tier: packages
source: generated
tags: [github-action-effects, api]
priority: 0.3
related: []
---

# CheckRunRecord

Recorded check run for testing.

```ts
interface CheckRunRecord
```

## Members

### conclusion

```ts
conclusion?: CheckRunConclusion;
```

### headSha

```ts
readonly headSha: string;
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

### outputs

```ts
readonly outputs: Array<CheckRunOutput>;
```

### status

```ts
status: "in_progress" | "completed";
```
