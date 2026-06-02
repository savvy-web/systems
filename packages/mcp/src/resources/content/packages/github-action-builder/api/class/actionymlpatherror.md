---
id: packages/github-action-builder/api/class/actionymlpatherror
title: "ActionYmlPathError — github-action-builder class"
summary: "Error when action.yml runs paths don't resolve correctly in destination."
tier: packages
source: generated
tags: [github-action-builder, api]
priority: 0.3
related: []
---

# ActionYmlPathError

Error when action.yml runs paths don't resolve correctly in destination.

```ts
class ActionYmlPathError extends ActionYmlPathErrorBase<{
    readonly entryType: string;
    readonly specifiedPath: string;
    readonly expectedPath: string;
}>
```

## Members

### entryType

```ts
readonly entryType: string;
```

The entry type whose path failed validation (main, pre, post).

### expectedPath

```ts
readonly expectedPath: string;
```

The expected resolved path.

### specifiedPath

```ts
readonly specifiedPath: string;
```

The path specified in action.yml.
