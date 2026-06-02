---
id: packages/github-action-builder/api/class/actionymlsyntaxerror
title: "ActionYmlSyntaxError — github-action-builder class"
summary: "Error when action.yml has invalid YAML syntax."
tier: packages
source: generated
tags: [github-action-builder, api]
priority: 0.3
related: []
---

# ActionYmlSyntaxError

Error when action.yml has invalid YAML syntax.

```ts
class ActionYmlSyntaxError extends ActionYmlSyntaxErrorBase<{
    readonly path: string;
    readonly message: string;
    readonly line?: number;
    readonly column?: number;
}>
```

## Members

### column

```ts
readonly column?: number;
```

Column number where the error occurred, if available.

### line

```ts
readonly line?: number;
```

Line number where the error occurred, if available.

### message

```ts
readonly message: string;
```

The syntax error message.

### path

```ts
readonly path: string;
```

The path to the action.yml file.
