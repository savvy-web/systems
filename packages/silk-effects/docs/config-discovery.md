# ConfigDiscovery

Locates config files following the Silk convention with priority-based search.

**Platform layer:** FileSystem

**Since:** 0.1.0

## What It Does

The Silk ecosystem has a convention where shared config files can live in
`lib/configs/` (provided by a dependency package) or at the workspace root
(local override). `ConfigDiscovery` searches both locations in priority order
and returns the first match. This lets repos use shared configs by default while
allowing per-repo overrides.

## Service API

```typescript
class ConfigDiscovery extends Context.Tag("@savvy-web/silk-effects/ConfigDiscovery")<
  ConfigDiscovery,
  {
    readonly find: (
      name: string,
      options?: { cwd?: string },
    ) => Effect.Effect<ConfigLocation | null>;

    readonly findAll: (
      name: string,
      options?: { cwd?: string },
    ) => Effect.Effect<ReadonlyArray<ConfigLocation>>;
  }
>() {}
```

### `find(name, options?)`

Return the highest-priority `ConfigLocation` for the given config file name, or
`null` when none of the candidate paths exist.

- **name** -- Config file name (e.g. `"biome.json"`, `"tsconfig.json"`).
- **options.cwd** -- Optional working directory override (defaults to `process.cwd()`).
- **Returns** -- `Effect<ConfigLocation | null>`. Always succeeds.

### `findAll(name, options?)`

Return all existing `ConfigLocation` entries for the given config file name,
ordered from highest to lowest priority.

- **name** -- Config file name.
- **options.cwd** -- Optional working directory override.
- **Returns** -- `Effect<ReadonlyArray<ConfigLocation>>`. Always succeeds (empty array if no matches).

## Layer

```typescript
export const ConfigDiscoveryLive: Layer.Layer<
  ConfigDiscovery,
  never,
  FileSystem.FileSystem
>;
```

Requires `FileSystem` from `@effect/platform`.

## Search Priority

| Priority | Path | Source |
| -------- | ---- | ------ |
| 1 (highest) | `{cwd}/lib/configs/{name}` | `"lib"` |
| 2 | `{cwd}/{name}` | `"root"` |

Missing files are silently skipped. Only files that actually exist on disk are
returned.

## Related Types

### ConfigLocation

```typescript
type ConfigLocation = {
  path: string;
  source: ConfigSource;
};
```

### ConfigSource

```typescript
type ConfigSource = "lib" | "root" | "cosmiconfig";
```

- `"lib"` -- Found under `lib/configs/{name}` relative to the workspace root.
- `"root"` -- Found directly in the workspace root as `{name}`.
- `"cosmiconfig"` -- Reserved for future cosmiconfig-based discovery.

### ConfigDiscoveryOptions

```typescript
type ConfigDiscoveryOptions = {
  cwd?: string;
  tool?: string;  // reserved for future use
};
```

## Error Types

### ConfigNotFoundError

Not raised by `ConfigDiscovery` directly (which returns `null` instead of
failing). Available for consumers that need a hard failure:

```typescript
class ConfigNotFoundError extends Data.TaggedError("ConfigNotFoundError")<{
  readonly name: string;
  readonly searchedPaths: ReadonlyArray<string>;
}> {}
```

Consumers can map a `null` result to this error:

```typescript
const config = yield* discovery.find("biome.json").pipe(
  Effect.flatMap((loc) =>
    loc
      ? Effect.succeed(loc)
      : Effect.fail(
          new ConfigNotFoundError({
            name: "biome.json",
            searchedPaths: ["lib/configs/biome.json", "biome.json"],
          }),
        ),
  ),
);
```

## Usage

```typescript
import { Effect } from "effect";
import { NodeContext } from "@effect/platform-node";
import { ConfigDiscovery, ConfigDiscoveryLive } from "@savvy-web/silk-effects";

const program = Effect.gen(function* () {
  const discovery = yield* ConfigDiscovery;

  // Find the highest-priority biome config
  const config = yield* discovery.find("biome.json");
  if (config) {
    console.log(`Found at ${config.path} (source: ${config.source})`);
  }

  // Find all tsconfig locations
  const all = yield* discovery.findAll("tsconfig.json");
  for (const loc of all) {
    console.log(`${loc.source}: ${loc.path}`);
  }
});

await Effect.runPromise(
  program.pipe(
    Effect.provide(ConfigDiscoveryLive),
    Effect.provide(NodeContext.layer),
  ),
);
```

## Dependencies on Other Services

None beyond `FileSystem` from the platform layer.
