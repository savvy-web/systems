---
id: packages/github-action-builder/api/class/entryfilemissing
title: "EntryFileMissing — github-action-builder class"
summary: "Error when an explicitly specified entry file is missing."
tier: packages
source: generated
tags: [github-action-builder, api]
priority: 0.3
related: []
---

# EntryFileMissing

Error when an explicitly specified entry file is missing.

```ts
class EntryFileMissing extends EntryFileMissingBase<{
    readonly entryType: "main" | "pre" | "post";
    readonly path: string;
}>
```

## Members

### entryType

```ts
readonly entryType: "main" | "pre" | "post";
```

The type of entry (main, pre, post).

### path

```ts
readonly path: string;
```

The path that was specified but not found.
