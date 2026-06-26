---
id: packages/github-action-builder/api/class/actionymlschemaerror
title: "ActionYmlSchemaError — github-action-builder class"
summary: "Error when action.yml fails schema validation."
tier: packages
source: generated
tags: [github-action-builder, api]
priority: 0.3
related: []
---

# ActionYmlSchemaError

Error when action.yml fails schema validation.

```ts
class ActionYmlSchemaError extends ActionYmlSchemaErrorBase<{
  readonly path: string;
  readonly errors: ReadonlyArray<{
    readonly path: string;
    readonly message: string;
  }>;
}>
```

## Members

### errors

```ts
readonly errors: ReadonlyArray<{
    readonly path: string;
    readonly message: string;
  }>;
```

List of schema validation errors.

### path

```ts
readonly path: string;
```

The path to the action.yml file.
