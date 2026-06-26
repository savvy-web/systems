---
id: packages/github-action-builder/api/class/workerentryinvalidname
title: "WorkerEntryInvalidName — github-action-builder class"
summary: "Error when a worker entry name is reserved or path-unsafe."
tier: packages
source: generated
tags: [github-action-builder, api]
priority: 0.3
related: []
---

# WorkerEntryInvalidName

Error when a worker entry name is reserved or path-unsafe.

```ts
class WorkerEntryInvalidName extends WorkerEntryInvalidNameBase<{
  readonly workerName: string; /** Why the name was rejected. */
  readonly reason: string;
}>
```

## Members

### reason

```ts
readonly reason: string;
```

### workerName

```ts
readonly workerName: string;
```

The offending worker name (config key).
