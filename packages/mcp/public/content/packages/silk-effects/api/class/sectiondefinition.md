---
id: packages/silk-effects/api/class/sectiondefinition
title: "SectionDefinition — silk-effects class"
summary: "Identity envelope for a managed section type. `Equal` compares on `toolName` + `commentStyle`. Use to create a SectionBlock, or `generate()` for a typed factor…"
tier: packages
source: generated
tags: [silk-effects, api]
priority: 0.3
related: []
---

# SectionDefinition

Identity envelope for a managed section type. `Equal` compares on `toolName` + `commentStyle`. Use to create a [SectionBlock](silk://packages/silk-effects/api/class/sectionblock), or `generate()` for a typed factory.

```ts
class SectionDefinition extends SectionDefinition_base
```

## Members

### [Equal.symbol]

```ts
[Equal.symbol](that: Equal.Equal): boolean;
```

### [Hash.symbol]

```ts
[Hash.symbol](): number;
```

### beginMarker

```ts
get beginMarker(): string;
```

### block

```ts
block(content: string): SectionBlock;
```

### diff

```ts
diff(that: SectionDefinition): SectionDiff;
```

### diff

```ts
static diff: {
    (that: SectionDefinition): (self: SectionDefinition) => SectionDiff;
    (self: SectionDefinition, that: SectionDefinition): SectionDiff;
  };
```

### endMarker

```ts
get endMarker(): string;
```

### generate

```ts
generate<C>(fn: (config: C) => string): (config: C) => SectionBlock;
```

### generate

```ts
static generate: {
    <C>(fn: (config: C) => string): (self: SectionDefinition) => (config: C) => SectionBlock;
    <C>(self: SectionDefinition, fn: (config: C) => string): (config: C) => SectionBlock;
  };
```

### generateEffect

```ts
generateEffect<C, E, R>(fn: (config: C) => Effect.Effect<string, E, R>): (config: C) => Effect.Effect<SectionBlock, E | SectionValidationError, R>;
```

### generateEffect

```ts
static generateEffect: {
    <C, E, R>(fn: (config: C) => Effect.Effect<string, E, R>): (self: SectionDefinition) => (config: C) => Effect.Effect<SectionBlock, E | SectionValidationError, R>;
    <C, E, R>(self: SectionDefinition, fn: (config: C) => Effect.Effect<string, E, R>): (config: C) => Effect.Effect<SectionBlock, E | SectionValidationError, R>;
  };
```

### withValidation

```ts
static withValidation: {
    (fn: (block: SectionBlock) => boolean): (self: SectionDefinition) => SectionDefinition;
    (self: SectionDefinition, fn: (block: SectionBlock) => boolean): SectionDefinition;
  };
```
