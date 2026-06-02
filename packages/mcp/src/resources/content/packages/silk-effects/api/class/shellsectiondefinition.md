---
id: packages/silk-effects/api/class/shellsectiondefinition
title: "ShellSectionDefinition — silk-effects class"
summary: "Convenience section definition for shell hooks. `commentStyle` is always `\"#\"` — only `toolName` is required."
tier: packages
source: generated
tags: [silk-effects, api]
priority: 0.3
related: []
---

# ShellSectionDefinition

Convenience section definition for shell hooks. `commentStyle` is always `"#"` — only `toolName` is required.

```ts
class ShellSectionDefinition extends ShellSectionDefinition_base
```

## Members

### beginMarker

```ts
get beginMarker(): string;
```

### block

```ts
block(content: string): SectionBlock;
```

### commentStyle

```ts
get commentStyle(): CommentStyle;
```

### endMarker

```ts
get endMarker(): string;
```

### generate

```ts
generate<C>(fn: (config: C) => string): (config: C) => SectionBlock;
```

### generateEffect

```ts
generateEffect<C, E, R>(fn: (config: C) => Effect.Effect<string, E, R>): (config: C) => Effect.Effect<SectionBlock, E, R>;
```
