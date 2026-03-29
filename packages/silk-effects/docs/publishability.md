# SilkPublishabilityPlugin

Determines whether a package is publishable under Silk conventions and resolves
its publish targets.

**Platform layer:** None (pure service, delegates to TargetResolver)

**Since:** 0.1.0

## What It Does

In the Silk ecosystem, `package.json` uses `publishConfig` to declare publish
intent. `SilkPublishabilityPlugin` inspects a parsed `package.json` object and
applies the Silk publishability rules to determine if the package should be
published, and if so, to which registries.

## Service API

```typescript
class SilkPublishabilityPlugin extends Context.Tag(
  "@savvy-web/silk-effects/SilkPublishabilityPlugin"
)<
  SilkPublishabilityPlugin,
  {
    readonly detect: (
      pkgJson: Record<string, unknown>,
    ) => Effect.Effect<ReadonlyArray<ResolvedTarget>, TargetResolutionError>;
  }
>() {}
```

### `detect(pkgJson)`

Inspect a parsed `package.json` object and return the resolved publish targets.

- **pkgJson** -- The parsed `package.json` contents as a plain object.
- **Returns** -- `Effect<ReadonlyArray<ResolvedTarget>, TargetResolutionError>`.
  Returns an empty array when the package is not publishable.

## Layer

```typescript
export const SilkPublishabilityPluginLive: Layer.Layer<
  SilkPublishabilityPlugin,
  never,
  TargetResolver
>;
```

Requires `TargetResolver` to resolve target strings and objects.

## Publishability Rules

The rules are evaluated in order. The first matching rule determines the result.

| # | Condition | Result |
| - | --------- | ------ |
| 1 | `private: true` AND no `publishConfig` | Not publishable (empty array) |
| 2 | No `publishConfig.access` AND no `publishConfig.targets` | Not publishable (empty array) |
| 3 | `publishConfig.targets` is an array | Resolve each target via TargetResolver |
| 4 | `publishConfig.registry` exists | Resolve as a single registry target |
| 5 | Default (has `publishConfig.access` but no targets/registry) | Resolve `"npm"` shorthand |

**Important:** In the Silk build system, `"private": true` in the source
`package.json` is normal. The builder transforms it based on `publishConfig.access`
during build. A package with `private: true` and `publishConfig.access: "public"`
is publishable.

## Error Types

### TargetResolutionError

Inherited from `TargetResolver.resolve`. Raised when a target in the
`publishConfig.targets` array cannot be resolved.

### PublishConfigError

Available for consumers that need to signal invalid `publishConfig` structure.

```typescript
class PublishConfigError extends Data.TaggedError("PublishConfigError")<{
  readonly packageName: string;
  readonly reason: string;
}> {}
```

## Usage

```typescript
import { Effect } from "effect";
import {
  SilkPublishabilityPlugin,
  SilkPublishabilityPluginLive,
  TargetResolverLive,
} from "@savvy-web/silk-effects";

const program = Effect.gen(function* () {
  const plugin = yield* SilkPublishabilityPlugin;
  return yield* plugin.detect({
    name: "@my-org/my-package",
    private: true,
    publishConfig: {
      access: "public",
      targets: ["npm", "github"],
    },
  });
});

const targets = await Effect.runPromise(
  program.pipe(
    Effect.provide(SilkPublishabilityPluginLive),
    Effect.provide(TargetResolverLive),
  ),
);
// => [{ registry: "https://registry.npmjs.org/", ... }, { registry: "https://npm.pkg.github.com/", ... }]
```

```typescript
// Not publishable -- returns empty array
const targets = await Effect.runPromise(
  Effect.gen(function* () {
    const plugin = yield* SilkPublishabilityPlugin;
    return yield* plugin.detect({ private: true });
  }).pipe(
    Effect.provide(SilkPublishabilityPluginLive),
    Effect.provide(TargetResolverLive),
  ),
);
// => []
```

## Dependencies on Other Services

- **TargetResolver** -- Used to resolve individual target values from `publishConfig.targets`
  and `publishConfig.registry`.
