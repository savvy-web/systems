---
id: packages/silk-effects/api/class/sectionblock
title: "SectionBlock — silk-effects class"
summary: "The content between managed section markers. `Equal` compares normalized content only (trimmed, whitespace-collapsed). Use `diff` to compute line-level differe…"
tier: packages
source: generated
tags: [silk-effects, api]
priority: 0.3
related: []
---

# SectionBlock

The content between managed section markers. `Equal` compares normalized content only (trimmed, whitespace-collapsed). Use `diff` to compute line-level differences.

```ts
class SectionBlock extends SectionBlock_base
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

### append

```ts
append(lines: string): SectionBlock;
```

### append

```ts
static append: {
    (lines: string): (self: SectionBlock) => SectionBlock;
    (self: SectionBlock, lines: string): SectionBlock;
  };
```

### diff

```ts
diff(that: SectionBlock): SectionDiff;
```

### diff

```ts
static diff: {
    (that: SectionBlock): (self: SectionBlock) => SectionDiff;
    (self: SectionBlock, that: SectionBlock): SectionDiff;
  };
```

### normalized

```ts
get normalized(): string;
```

### prepend

```ts
prepend(lines: string): SectionBlock;
```

### prepend

```ts
static prepend: {
    (lines: string): (self: SectionBlock) => SectionBlock;
    (self: SectionBlock, lines: string): SectionBlock;
  };
```

### rendered

```ts
get rendered(): string;
```

### text

```ts
get text(): string;
```
