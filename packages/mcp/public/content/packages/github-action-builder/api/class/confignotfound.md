---
id: packages/github-action-builder/api/class/confignotfound
title: "ConfigNotFound — github-action-builder class"
summary: "Error when configuration file is not found."
tier: packages
source: generated
tags: [github-action-builder, api]
priority: 0.3
related: []
---

# ConfigNotFound

Error when configuration file is not found.

```ts
class ConfigNotFound extends ConfigNotFoundBase<{
  readonly path: string;
  readonly message?: string;
}>
```

## Members

### message

```ts
readonly message?: string;
```

Additional context about the search.

### path

```ts
readonly path: string;
```

The path that was searched for the config file.
