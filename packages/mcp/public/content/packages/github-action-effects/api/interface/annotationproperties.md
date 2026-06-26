---
id: packages/github-action-effects/api/interface/annotationproperties
title: "AnnotationProperties — github-action-effects interface"
summary: "GitHub annotation properties shared by `::notice::`, `::warning::`, and `::error::` commands. Matches `@actions/core` `AnnotationProperties`."
tier: packages
source: generated
tags: [github-action-effects, api]
priority: 0.3
related: []
---

# AnnotationProperties

GitHub annotation properties shared by `::notice::`, `::warning::`, and `::error::` commands. Matches `@actions/core` `AnnotationProperties`.

```ts
interface AnnotationProperties
```

## Members

### endColumn

```ts
readonly endColumn?: number;
```

The end column for the annotation. Cannot span multiple lines.

### endLine

```ts
readonly endLine?: number;
```

The end line for the annotation.

### file

```ts
readonly file?: string;
```

The path of the file the annotation should be attached to.

### startColumn

```ts
readonly startColumn?: number;
```

The start column for the annotation. Cannot span multiple lines.

### startLine

```ts
readonly startLine?: number;
```

The start line for the annotation.

### title

```ts
readonly title?: string;
```

A title for the annotation.
