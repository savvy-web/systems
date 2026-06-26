---
id: packages/github-action-effects/api/interface/actionloggerteststate
title: "ActionLoggerTestState — github-action-effects interface"
summary: "In-memory state captured by the test logger."
tier: packages
source: generated
tags: [github-action-effects, api]
priority: 0.3
related: []
---

# ActionLoggerTestState

In-memory state captured by the test logger.

```ts
interface ActionLoggerTestState
```

## Members

### entries

```ts
readonly entries: Array<{
    readonly level: string;
    readonly message: string;
  }>;
```

### flushedBuffers

```ts
readonly flushedBuffers: Array<{
    readonly label: string;
    readonly entries: Array<string>;
  }>;
```

### groups

```ts
readonly groups: Array<{
    readonly name: string;
    readonly entries: Array<{
      readonly level: string;
      readonly message: string;
    }>;
  }>;
```

### notices

```ts
readonly notices: Array<{
    readonly message: string;
    readonly properties: AnnotationProperties | undefined;
  }>;
```
