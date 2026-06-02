---
id: packages/github-action-builder/api/class/configinvalid
title: "ConfigInvalid — github-action-builder class"
summary: "Error when configuration file exists but contains invalid content."
tier: packages
source: generated
tags: [github-action-builder, api]
priority: 0.3
related: []
---

# ConfigInvalid

Error when configuration file exists but contains invalid content.

```ts
class ConfigInvalid extends ConfigInvalidBase<{
    readonly path: string;
    readonly errors: ReadonlyArray<string>;
}>
```

## Members

### errors

```ts
readonly errors: ReadonlyArray<string>;
```

List of validation errors.

### path

```ts
readonly path: string;
```

The path to the invalid config file.
