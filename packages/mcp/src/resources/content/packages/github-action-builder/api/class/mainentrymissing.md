---
id: packages/github-action-builder/api/class/mainentrymissing
title: "MainEntryMissing — github-action-builder class"
summary: "Error when the required main entry point is missing."
tier: packages
source: generated
tags: [github-action-builder, api]
priority: 0.3
related: []
---

# MainEntryMissing

Error when the required main entry point is missing.

```ts
class MainEntryMissing extends MainEntryMissingBase<{
    readonly expectedPath: string;
    readonly cwd: string;
}>
```

## Members

### cwd

```ts
readonly cwd: string;
```

The working directory that was searched.

### expectedPath

```ts
readonly expectedPath: string;
```

The expected path for the main entry.
