# VersioningStrategy

Classifies the versioning strategy used by a workspace.

**Platform layer:** FileSystem (via ChangesetConfigReader)

**Since:** 0.1.0

## What It Does

A workspace may have one publishable package, several packages in a fixed
version group, or many independently versioned packages. `VersioningStrategy`
reads the changesets configuration, inspects `fixed` groups, and classifies the
workspace into one of three strategy types. This result is consumed by
`TagStrategy` to determine the git tag format.

## Service API

```typescript
class VersioningStrategy extends Context.Tag(
  "@savvy-web/silk-effects/VersioningStrategy"
)<
  VersioningStrategy,
  {
    readonly detect: (
      publishablePackages: ReadonlyArray<string>,
      root: string,
    ) => Effect.Effect<VersioningStrategyResult, VersioningDetectionError>;
  }
>() {}
```

### `detect(publishablePackages, root)`

Classify the versioning strategy for a list of publishable package names.

- **publishablePackages** -- Package names (e.g. `"@my-org/pkg"`) that will be published.
- **root** -- Workspace root directory to read changeset config from.
- **Returns** -- `Effect<VersioningStrategyResult, VersioningDetectionError>`

## Layer

```typescript
export const VersioningStrategyLive: Layer.Layer<
  VersioningStrategy,
  never,
  ChangesetConfigReader
>;
```

Requires `ChangesetConfigReader` to read the workspace changeset configuration.
If the config file is absent, empty `fixed` groups are assumed.

## Related Types

### VersioningStrategyResult

```typescript
type VersioningStrategyResult = {
  type: VersioningStrategyType;
  fixedGroups: string[][];
  publishablePackages: string[];
};
```

### VersioningStrategyType

```typescript
type VersioningStrategyType = "single" | "fixed-group" | "independent";
```

| Type | Condition |
| ---- | --------- |
| `"single"` | 0 or 1 publishable packages |
| `"fixed-group"` | All publishable packages are in a single `fixed` group |
| `"independent"` | Multiple publishable packages not all in the same fixed group |

## Error Types

### VersioningDetectionError

Raised when the strategy cannot be determined from the workspace state.

```typescript
class VersioningDetectionError extends Data.TaggedError("VersioningDetectionError")<{
  readonly reason: string;
}> {}
```

## Usage

```typescript
import { Effect } from "effect";
import { NodeContext } from "@effect/platform-node";
import {
  VersioningStrategy,
  VersioningStrategyLive,
  ChangesetConfigReaderLive,
} from "@savvy-web/silk-effects";

const program = Effect.gen(function* () {
  const strategy = yield* VersioningStrategy;
  return yield* strategy.detect(
    ["@my-org/pkg-a", "@my-org/pkg-b"],
    process.cwd(),
  );
});

const result = await Effect.runPromise(
  program.pipe(
    Effect.provide(VersioningStrategyLive),
    Effect.provide(ChangesetConfigReaderLive),
    Effect.provide(NodeContext.layer),
  ),
);
// result.type => "single" | "fixed-group" | "independent"
```

## Dependencies on Other Services

- **ChangesetConfigReader** -- Reads `.changeset/config.json` to inspect `fixed` groups.
  Falls back to empty groups when the config file is not found.

## Relationship to TagStrategy

`VersioningStrategy.detect` produces a `VersioningStrategyResult` that is
passed to `TagStrategy.determine` to decide the tag format:

```typescript
const program = Effect.gen(function* () {
  const versioning = yield* VersioningStrategy;
  const tags = yield* TagStrategy;

  const result = yield* versioning.detect(["@my-org/pkg"], process.cwd());
  const tagType = yield* tags.determine(result);
  const tag = yield* tags.formatTag("@my-org/pkg", "1.0.0", tagType);
  return tag;
});
```
