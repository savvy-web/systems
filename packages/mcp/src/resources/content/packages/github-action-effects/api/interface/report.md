---
id: packages/github-action-effects/api/interface/report
title: "Report — github-action-effects interface"
summary: "An immutable report that accumulates content and renders to markdown."
tier: packages
source: generated
tags: [github-action-effects, api]
priority: 0.3
related: []
---

# Report

An immutable report that accumulates content and renders to markdown.

```ts
interface Report
```

## Members

### details

```ts
readonly details: (summary: string, content: string) => Report;
```

Add a collapsible details block.

### section

```ts
readonly section: (title: string, content: string) => Report;
```

Add a titled section with markdown content.

### stat

```ts
readonly stat: (label: string, value: string | number) => Report;
```

Add a key-value summary row.

### toCheckRun

```ts
readonly toCheckRun: (checkRunId: number) => Effect.Effect<void, CheckRunError, CheckRun>;
```

Set as check run output via [CheckRun](silk://packages/github-action-effects/api/class/checkrun).

### toComment

```ts
readonly toComment: (prNumber: number, markerKey: string) => Effect.Effect<void, PullRequestCommentError, PullRequestComment>;
```

Upsert as PR comment via [PullRequestComment](silk://packages/github-action-effects/api/class/pullrequestcomment).

### toMarkdown

```ts
readonly toMarkdown: () => string;
```

Render to markdown string.

### toSummary

```ts
readonly toSummary: () => Effect.Effect<void, ActionOutputError, ActionOutputs>;
```

Write to step summary via [ActionOutputs](silk://packages/github-action-effects/api/class/actionoutputs).
