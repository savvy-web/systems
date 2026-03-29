# Tags Module

[Back to README](../README.md)

Git tag strategy determination and formatting based on versioning strategy.

```typescript
import { TagStrategy, TagStrategyLive } from "@savvy-web/silk-effects/tags";
```

## Table of Contents

- [Overview](#overview)
- [Service](#service)
- [Tag Formats](#tag-formats)
- [Schemas](#schemas)
- [Errors](#errors)
- [Examples](#examples)

## Overview

The tags module consumes a `VersioningStrategyResult` (from the versioning module) and determines whether the workspace should use single or scoped git tags. It then formats tag strings according to the chosen strategy. This is a pure module with no filesystem dependencies.

## Service

### TagStrategy

Determines and applies the git-tag naming strategy for a release.

```typescript
class TagStrategy {
  readonly determine: (
    versioningResult: VersioningStrategyResult,
  ) => Effect.Effect<TagStrategyType>;

  readonly formatTag: (
    name: string,
    version: string,
    strategy: TagStrategyType,
  ) => Effect.Effect<string, TagFormatError>;
}
```

**Layer:** `TagStrategyLive` -- no dependencies.

#### determine

Maps a versioning strategy result to a tag strategy type:

- `"single"` or `"fixed-group"` versioning produces `"single"` tags.
- `"independent"` versioning produces `"scoped"` tags.

#### formatTag

Formats a git tag string. Fails with `TagFormatError` when `version` is empty.

## Tag Formats

| Strategy | Package Name | Output |
| -------- | ------------ | ------ |
| `"single"` | (any) | `1.2.3` |
| `"scoped"` | `@scope/pkg` | `@scope/pkg@1.2.3` |
| `"scoped"` | `my-pkg` | `my-pkg@1.2.3` |

All tags use strict SemVer 2.0.0 — no `v` prefix.

## Schemas

### TagStrategyType

```typescript
type TagStrategyType = "single" | "scoped";
```

## Errors

### TagFormatError

Raised when a tag string cannot be formatted. Contains `name`, `version`, and `reason`.

```typescript
class TagFormatError extends Data.TaggedError("TagFormatError")<{
  readonly name: string;
  readonly version: string;
  readonly reason: string;
}> {}
```

Currently only triggered when `version` is an empty string.

## Examples

### Determine and format tags

```typescript
import { Effect } from "effect";
import { TagStrategy, TagStrategyLive } from "@savvy-web/silk-effects/tags";
import type { VersioningStrategyResult } from "@savvy-web/silk-effects/versioning";

const tag = await Effect.runPromise(
  Effect.gen(function* () {
    const tags = yield* TagStrategy;

    const versioningResult: VersioningStrategyResult = {
      type: "independent",
      fixedGroups: [],
      publishablePackages: ["@my-org/core", "@my-org/cli"],
    };

    const strategyType = yield* tags.determine(versioningResult);
    return yield* tags.formatTag("@my-org/core", "2.0.0", strategyType);
  }).pipe(Effect.provide(TagStrategyLive)),
);
// => "@my-org/core@2.0.0"
```

### Single-package workspace

```typescript
import { Effect } from "effect";
import { TagStrategy, TagStrategyLive } from "@savvy-web/silk-effects/tags";

const tag = await Effect.runPromise(
  Effect.gen(function* () {
    const tags = yield* TagStrategy;
    const strategyType = yield* tags.determine({
      type: "single",
      fixedGroups: [],
      publishablePackages: ["my-package"],
    });
    return yield* tags.formatTag("my-package", "1.0.0", strategyType);
  }).pipe(Effect.provide(TagStrategyLive)),
);
// => "1.0.0"
```

### Handle format errors

```typescript
import { Effect } from "effect";
import { TagStrategy, TagStrategyLive } from "@savvy-web/silk-effects/tags";

const result = await Effect.runPromise(
  Effect.gen(function* () {
    const tags = yield* TagStrategy;
    return yield* tags.formatTag("my-pkg", "", "single");
  }).pipe(
    Effect.catchTag("TagFormatError", (err) =>
      Effect.succeed(`Error: ${err.reason}`),
    ),
    Effect.provide(TagStrategyLive),
  ),
);
// => "Error: version cannot be empty"
```
