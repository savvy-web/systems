# TagStrategy

Determines and applies the git-tag naming strategy for a release.

**Platform layer:** None (pure service, no I/O)

**Since:** 0.1.0

## What It Does

The Silk ecosystem uses strict SemVer 2.0.0 tags (no `v` prefix). A workspace
with a single publishable package uses bare version tags (`1.2.3`). A workspace
with independent versioning uses scoped tags that include the package name
(`@scope/pkg@1.2.3`). `TagStrategy` consumes a `VersioningStrategyResult` to
pick the right format, then formats tag strings accordingly.

## Service API

```typescript
class TagStrategy extends Context.Tag("@savvy-web/silk-effects/TagStrategy")<
  TagStrategy,
  {
    readonly determine: (
      versioningResult: VersioningStrategyResult,
    ) => Effect.Effect<TagStrategyType>;

    readonly formatTag: (
      name: string,
      version: string,
      strategy: TagStrategyType,
    ) => Effect.Effect<string, TagFormatError>;
  }
>() {}
```

### `determine(versioningResult)`

Determine the appropriate tag strategy type from a versioning strategy result.

- **versioningResult** -- The result of `VersioningStrategy.detect`.
- **Returns** -- `Effect<TagStrategyType>`. Always succeeds.

Mapping:

- `"independent"` versioning --> `"scoped"` tags
- `"single"` or `"fixed-group"` versioning --> `"single"` tags

### `formatTag(name, version, strategy)`

Format a git tag string for a given package name, version, and strategy.

- **name** -- The package name (e.g. `"@my-org/pkg"` or `"my-pkg"`).
- **version** -- The semver version string (e.g. `"1.2.3"`). Must not be empty.
- **strategy** -- The `TagStrategyType` to apply.
- **Returns** -- `Effect<string, TagFormatError>`

## Layer

```typescript
export const TagStrategyLive: Layer.Layer<TagStrategy>;
```

No dependencies. All logic is pure.

## Related Types

### TagStrategyType

```typescript
type TagStrategyType = "single" | "scoped";
```

- `"single"` -- One shared tag for the entire release: `1.2.3`
- `"scoped"` -- Per-package tag including the package name: `@scope/pkg@1.2.3` or `my-pkg@1.2.3`

### VersioningStrategyResult

Input type produced by `VersioningStrategy.detect`:

```typescript
type VersioningStrategyResult = {
  type: "single" | "fixed-group" | "independent";
  fixedGroups: string[][];
  publishablePackages: string[];
};
```

## Tag Format Examples

| Strategy | Package Name | Version | Tag |
| -------- | ------------ | ------- | --- |
| `single` | `@my-org/pkg` | `1.2.3` | `1.2.3` |
| `scoped` | `@my-org/pkg` | `1.2.3` | `@my-org/pkg@1.2.3` |
| `scoped` | `my-pkg` | `2.0.0` | `my-pkg@2.0.0` |

All tags use strict SemVer 2.0.0 with no `v` prefix.

## Error Types

### TagFormatError

Raised when the `version` argument is empty or another invariant prevents tag
construction.

```typescript
class TagFormatError extends Data.TaggedError("TagFormatError")<{
  readonly name: string;
  readonly version: string;
  readonly reason: string;
}> {}
```

## Usage

```typescript
import { Effect } from "effect";
import { TagStrategy, TagStrategyLive } from "@savvy-web/silk-effects";

const program = Effect.gen(function* () {
  const tags = yield* TagStrategy;

  // Determine strategy from versioning result
  const strategyType = yield* tags.determine({
    type: "independent",
    fixedGroups: [],
    publishablePackages: ["@my-org/pkg-a", "@my-org/pkg-b"],
  });
  // => "scoped"

  // Format a tag
  const tag = yield* tags.formatTag("@my-org/pkg-a", "1.2.3", strategyType);
  // => "@my-org/pkg-a@1.2.3"

  return tag;
});

await Effect.runPromise(program.pipe(Effect.provide(TagStrategyLive)));
```

## Dependencies on Other Services

None. `TagStrategy` is a leaf service. It consumes `VersioningStrategyResult`
as a plain data value, not as a service dependency.
