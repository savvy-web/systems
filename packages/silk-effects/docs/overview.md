# Package overview

## What is silk-effects?

`@savvy-web/silk-effects` is a platform-agnostic [Effect](https://effect.website/) library that provides shared conventions for the Silk Suite ecosystem. It extracts repeated patterns from across the repositories into a single package consumed by GitHub Actions, CLI tools and build scripts.

## Design philosophy

### Platform-agnostic

The library builds on `@effect/platform` abstractions rather than importing Node.js or Bun APIs directly. Consumers provide their runtime layer (`NodeContext.layer`, `BunContext.layer`) at the edge of their program. This means the same service implementations work across Node.js, Bun and any future `@effect/platform` runtime.

### Effect-based composition

Every service is a `Context.Tag` that you access with `yield*` inside `Effect.gen`. Services declare their dependencies through their `Layer` type signature. You compose layers to build the full dependency graph, and the Effect type system ensures you provide everything required.

### Single root export

All public API is exported from the package root. There are no sub-path exports. You always import from `@savvy-web/silk-effects`:

```typescript
import {
  SilkPublishability,
  ManagedSection, ManagedSectionLive,
  SectionDefinition, SectionBlock,
  ToolDiscovery, ToolDiscoveryLive,
  ToolDefinition,
} from "@savvy-web/silk-effects";
```

### Value objects with structural equality

Schemas and value objects implement `Equal.Equal` and `Hash.Hash` for structural comparison. For example, two `SectionBlock` instances are equal if their normalized content matches, regardless of leading/trailing whitespace.

## Platform layer concept

Services fall into three tiers based on their runtime requirements:

1. **No platform layer** — pure services with no I/O. Provide only the service's own `Live` layer, or in the case of `SilkPublishability.detect`, call the static directly.
2. **FileSystem layer** — services that read or write files. Provide the service layer plus `NodeContext.layer` (or `BunContext.layer`).
3. **FileSystem + CommandExecutor layer** — services that also execute shell commands. Same as above, but additionally requires `CommandExecutor`, `PackageManagerDetector` and `WorkspaceRoot` from `workspaces-effect`.

See [Platform layers](./platform-layers.md) for the full guide.

## Quick start

### Pure logic (no layers)

`SilkPublishability.detect` is a static — call it directly with a package name and the raw `package.json`:

```typescript
import { SilkPublishability } from "@savvy-web/silk-effects";

const targets = SilkPublishability.detect("@my-org/pkg", {
  private: true,
  publishConfig: { access: "public", targets: ["npm"] },
});
// => [PublishTarget { registry: "https://registry.npmjs.org/", access: "public", ... }]
```

### FileSystem service

```typescript
import { Effect } from "effect";
import { NodeContext } from "@effect/platform-node";
import {
  ManagedSection,
  ManagedSectionLive,
  SectionDefinition,
} from "@savvy-web/silk-effects";

const def = SectionDefinition.make({ toolName: "MY-TOOL" });

const result = await Effect.runPromise(
  Effect.gen(function* () {
    const ms = yield* ManagedSection;
    const block = def.block("\nnpx lint-staged\n");
    return yield* ms.sync(".husky/pre-commit", block);
  }).pipe(
    Effect.provide(ManagedSectionLive),
    Effect.provide(NodeContext.layer),
  ),
);
// => SyncResult: Created | Updated | Unchanged
```

### CommandExecutor service

```typescript
import { Effect } from "effect";
import { NodeContext } from "@effect/platform-node";
import {
  ToolDiscovery,
  ToolDiscoveryLive,
  ToolDefinition,
} from "@savvy-web/silk-effects";

const output = await Effect.runPromise(
  Effect.gen(function* () {
    const td = yield* ToolDiscovery;
    const tool = yield* td.resolve(ToolDefinition.make({ name: "biome" }));
    return yield* tool.exec("check", ".").string();
  }).pipe(
    Effect.provide(ToolDiscoveryLive),
    Effect.provide(NodeContext.layer),
  ),
);
```

## Dependencies

```text
@savvy-web/silk-effects
  |- effect (peer)
  |- @effect/platform (peer)
  |- workspaces-effect (direct)
  |- semver-effect (direct)
  |- jsonc-effect (direct)
  +- yaml-effect (direct)
```

`effect` and `@effect/platform` are peer dependencies. Consumers install them alongside this package to avoid version conflicts and bundle duplication.

## Error handling

All errors extend `Data.TaggedError` with a `_tag` discriminant and a `message` getter. This makes them pattern-matchable with `Effect.catchTag`:

```typescript
import { Effect } from "effect";
import {
  ChangesetConfigReader, ChangesetConfigReaderLive,
} from "@savvy-web/silk-effects";
import { NodeContext } from "@effect/platform-node";

const config = await Effect.runPromise(
  Effect.gen(function* () {
    const reader = yield* ChangesetConfigReader;
    return yield* reader.read(process.cwd());
  }).pipe(
    Effect.catchTag("ChangesetConfigError", (err) =>
      Effect.succeed(`Fallback: ${err.reason}`)
    ),
    Effect.provide(ChangesetConfigReaderLive),
    Effect.provide(NodeContext.layer),
  ),
);
```

The `SilkPublishability` API does not raise errors: the pure `detect` returns `[]` for non-publishable packages, and the detector layers have an error channel of `never`.

## Service index

| Service | Platform layer | Page |
| ------- | -------------- | ---- |
| SilkPublishability | None (static `detect`) | [publishability.md](./publishability.md) |
| TagStrategy | None | [tag-strategy.md](./tag-strategy.md) |
| SilkPublishabilityDetectorLive / PublishabilityDetectorAdaptiveLive | FileSystem (+ ChangesetConfig) | [publishability.md](./publishability.md) |
| ChangesetConfig | FileSystem | [changeset-config.md](./changeset-config.md) |
| ChangesetConfigReader | FileSystem | [changeset-config.md](./changeset-config.md) |
| VersioningStrategy | FileSystem | [versioning-strategy.md](./versioning-strategy.md) |
| ManagedSection | FileSystem | [managed-section.md](./managed-section.md) |
| ConfigDiscovery | FileSystem | [config-discovery.md](./config-discovery.md) |
| BiomeSchemaSync | FileSystem | [biome-sync.md](./biome-sync.md) |
| ToolDiscovery | FileSystem + CommandExecutor | [tool-discovery.md](./tool-discovery.md) |
