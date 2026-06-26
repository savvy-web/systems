---
id: packages/github-action-effects/api/interface/idempotentpublishresult
title: "IdempotentPublishResult — github-action-effects interface"
summary: "Outcome of `PackagePublish.publishIdempotent`."
tier: packages
source: generated
tags: [github-action-effects, api]
priority: 0.3
related: []
---

# IdempotentPublishResult

Outcome of `PackagePublish.publishIdempotent`.

```ts
interface IdempotentPublishResult
```

## Members

### packageName

```ts
readonly packageName: string;
```

### skipReason

```ts
readonly skipReason?: "already-published-identical";
```

Set only when `status` is `"skipped"`.

### status

```ts
readonly status: "published" | "skipped";
```

`"published"` when the package was published; `"skipped"` when an identical version already existed.

### version

```ts
readonly version: string;
```
