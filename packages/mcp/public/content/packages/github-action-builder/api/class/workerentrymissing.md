---
id: packages/github-action-builder/api/class/workerentrymissing
title: "WorkerEntryMissing — github-action-builder class"
summary: "Error when a worker entry source file is not found."
tier: packages
source: generated
tags: [github-action-builder, api]
priority: 0.3
related: []
---

# WorkerEntryMissing

Error when a worker entry source file is not found.

```ts
class WorkerEntryMissing extends WorkerEntryMissingBase<{
  readonly workerName: string; /** The expected path for the worker entry. */
  readonly expectedPath: string; /** The working directory that was searched. */
  readonly cwd: string;
}>
```

## Members

### cwd

```ts
readonly cwd: string;
```

### expectedPath

```ts
readonly expectedPath: string;
```

### workerName

```ts
readonly workerName: string;
```

The worker name (config key).
