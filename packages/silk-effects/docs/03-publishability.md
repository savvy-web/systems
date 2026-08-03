# Publishability

Determine whether a package is publishable under Silk conventions and resolve its publish targets.

## What it does

In the Silk ecosystem, `package.json` uses `publishConfig` to declare publish intent, and `private: true` is the norm on workspace packages. `SilkPublishability` applies the silk publishability rules to a raw `package.json` and the bundler's resolved target binding, then returns the publish targets it resolves. A target is a `PublishTarget` record from `@effected/workspaces` with `name`, `registry`, `directory`, `access` and `provenance` fields.

Publish targets are declared as the bundler's keyed `publishConfig.targets` map (`{ npm: true, github: true }`). The bundler's `--target prod` build writes a `dist/prod/targets.json` binding that records the distinct byte-variant groups and binds each declared registry target to one group; `detect` resolves against that binding. The legacy array form of `publishConfig.targets` is no longer supported.

The surface comes in four levels:

- `SilkPublishability.detect` — a pure static you call directly, no layers. Takes the raw `package.json` plus the binding (`null` before the prod build has run).
- `readTargetsBinding` — an Effect that reads a package's `dist/prod/targets.json` binding for `detect`, returning `null` when it is missing (pre-build).
- `SilkPublishability.layer` / `SilkPublishability.layerAdaptive` — layers that override `@effected/workspaces`'s `PublishabilityDetector` Tag, so silk rules flow into any program that yields the detector.
- `SilkPublishability.resolveTargets` / `SilkPublishability.listPublishable` — Effects that read from disk to filter targets and discover publishable packages.

## SilkPublishability

A class whose members are all static, so a consumer sees the full rule surface in one place.

```typescript
class SilkPublishability {
  static detect(
    pkgName: string,
    raw: RawPackageJson,
    binding: TargetsBinding | null,
  ): ReadonlyArray<PublishTarget>;
  static resolveTargets(
    pkg: WorkspacePackage,
    root: string,
  ): Effect.Effect<ReadonlyArray<PublishTarget>, never, PublishabilityDetector | FileSystem.FileSystem>;
  static listPublishable(
    root: string,
  ): Effect.Effect<ReadonlyArray<PublishablePackage>, never, WorkspaceDiscovery | PublishabilityDetector>;
}
```

### `detect(pkgName, raw, binding)`

Apply the silk rules to a raw `package.json` and the bundler's resolved target binding, and return the resolved targets. Pure — no Effect, no layers.

- **pkgName** — the package name, used as the base name for `true`/empty-object targets and to populate each `PublishTarget.name`.
- **raw** — the raw `package.json` fields silk rules consult (`RawPackageJson`).
- **binding** — the parsed `dist/prod/targets.json` binding (`TargetsBinding`), or `null` when the prod build has not run yet. With a binding, one `PublishTarget` is emitted per resolved registry target and its `directory` is the bound group's `dist/prod/<group>/pkg`; `npm: true` + `github: true` collapse into one byte-group deployed to two registries. Without a binding, one count-accurate placeholder is emitted per declared key so publishability and target counts are correct before the build.
- **Returns** — `ReadonlyArray<PublishTarget>`. Empty when the package is not publishable.

### `readTargetsBinding(fs, pkgPath)`

Read a package's `dist/prod/targets.json` binding from disk, returning `null` when the file is missing or malformed (i.e. the prod build has not run). The detector layers and the workspace analyzer call this and thread the result into `detect`. Requires `FileSystem`.

### `resolveTargets(pkg, root)`

Resolve a package's publish targets via the `PublishabilityDetector` Tag, then drop any whose built `directory` `package.json` is `private: true`. Returned targets keep the detector's original (possibly package-relative) `directory`. Requires `PublishabilityDetector` and `FileSystem`.

### `listPublishable(root)`

The publishable, non-ignored packages in a workspace, resolved through the single `PublishabilityDetector` (which already honors changeset ignore in adaptive mode). Returns `PublishablePackage` records (`name`, `version`, `path`, `targetCount`). Requires `WorkspaceDiscovery` and `PublishabilityDetector`.

## Publishability rules

`detect` evaluates these in order. The first matching rule determines the result.

| # | Condition | Result |
| - | --------- | ------ |
| 1 | `publishConfig.targets` is a non-empty map | With a binding: one `PublishTarget` per resolved registry target, its directory the bound group's `dist/prod/<group>/pkg`. Without a binding: one count-accurate placeholder per declared key |
| 2 | `publishConfig.access` is `public` or `restricted` | A single `PublishTarget` |
| 3 | `private !== true` | A single default `PublishTarget` |
| 4 | otherwise | `[]` (not publishable) |

Targets-first precedence means a non-empty `publishConfig.targets` map resolves regardless of the `private` flag. The `private` flag is consulted only as the last-resort default in rule 3. An empty map, or the legacy array form (no longer supported), falls through to the access/private branches rather than resolving to zero targets.

## Detector overrides

`SilkPublishability.detect` is also exposed through `@effected/workspaces`'s `PublishabilityDetector` Tag. Provide one of these layers and every consumer that yields `PublishabilityDetector` gets silk behavior.

### SilkPublishability.layer

```typescript
static readonly layer: Layer.Layer<
  PublishabilityDetector,
  never,
  FileSystem.FileSystem
>;
```

Applies silk rules unconditionally. `detect` reads the raw `package.json` from `pkg.packageJsonPath` and applies `SilkPublishability.detect`. Requires `FileSystem`.

```typescript
import { Effect } from "effect";
import { NodeServices } from "@effect/platform-node";
import { PublishabilityDetector } from "@effected/workspaces";
import { SilkPublishability } from "@savvy-web/silk-effects";

const program = Effect.gen(function* () {
  const detector = yield* PublishabilityDetector;
  return yield* detector.detect(pkg, root);
}).pipe(
  Effect.provide(SilkPublishability.layer),
  Effect.provide(NodeServices.layer),
);

const targets = await Effect.runPromise(program);
// => ReadonlyArray<PublishTarget>
```

### SilkPublishability.layerAdaptive

```typescript
static readonly layerAdaptive: Layer.Layer<
  PublishabilityDetector,
  never,
  FileSystem.FileSystem | ChangesetConfig
>;
```

Ignore-aware. `detect` short-circuits to `[]` for changeset-`ignore`d packages, then dispatches on `ChangesetConfig.mode`:

- `none` → `[]`
- `silk` → `SilkPublishability.detect`
- `vanilla` → the `@effected/workspaces` library default

Requires `FileSystem` and `ChangesetConfig`. Compose it with the `ChangesetConfig` service and its reader:

```typescript
import { Effect, Layer } from "effect";
import { NodeServices } from "@effect/platform-node";
import { PublishabilityDetector } from "@effected/workspaces";
import {
  ChangesetConfig, ChangesetConfigReader,
  SilkPublishability,
} from "@savvy-web/silk-effects";

const layer = Layer.mergeAll(
  SilkPublishability.layerAdaptive.pipe(Layer.provide(ChangesetConfig.layer)),
  ChangesetConfig.layer,
  ChangesetConfigReader.layer,
).pipe(Layer.provide(NodeServices.layer));

const program = Effect.gen(function* () {
  const detector = yield* PublishabilityDetector;
  return yield* detector.detect(pkg, root);
}).pipe(Effect.provide(layer));

const targets = await Effect.runPromise(program);
// => ReadonlyArray<PublishTarget>
```

## Related types

```typescript
// A single object-form publish target in the publishConfig.targets map
interface RawTargetObject {
  readonly registry?: string;
  readonly name?: string; // name override; mutually exclusive with `from`
  readonly from?: string; // reuse another target's group bytes
}

// A publishConfig.targets value: true (well-known registry, base name), a string
// (name override), or an object
type RawTargetValue = true | string | RawTargetObject;

// The publishConfig.targets map, keyed by target id (npm, github, or a custom key)
type RawPublishTargets = Record<string, RawTargetValue>;

// The raw publishConfig fields silk rules consult
interface RawPublishConfig {
  readonly access?: "public" | "restricted";
  readonly registry?: string;
  readonly directory?: string;
  readonly targets?: RawPublishTargets;
}

// The raw package.json fields silk rules consult
interface RawPackageJson {
  readonly name?: string;
  readonly version?: string;
  readonly private?: boolean;
  readonly publishConfig?: RawPublishConfig;
}

// A publishable workspace package and the count of its resolved targets
interface PublishablePackage {
  readonly name: string;
  readonly version: string;
  readonly path: string;
  readonly targetCount: number;
}
```

The bundler's `dist/prod/targets.json` binding types describe what `detect` resolves against:

```typescript
// A resolved byte-variant group from dist/prod/targets.json
interface TargetGroupBinding {
  readonly id: string; // group folder id
  readonly name: string; // the package.json name this group's manifest carries
  readonly dir: string; // the group's pkg output dir, e.g. dist/prod/npm/pkg
}

// A resolved registry target (one per publishConfig.targets key)
interface TargetBinding {
  readonly id: string; // the publishConfig.targets key (npm, github, …)
  readonly group: string; // the group id whose bytes this target deploys
  readonly name: string; // the resolved name for that group
  readonly registry: string; // the resolved registry endpoint
}

// The dist/prod/targets.json binding the bundler emits for the release step
interface TargetsBinding {
  readonly groups: ReadonlyArray<TargetGroupBinding>;
  readonly targets: ReadonlyArray<TargetBinding>;
}
```

`PublishTarget` comes from `@effected/workspaces` (import it from there) and carries `name`, `registry`, `directory`, `access` and `provenance`.

## Usage

```typescript
import { SilkPublishability } from "@savvy-web/silk-effects";

// Targets-first: one PublishTarget per declared publishConfig.targets key
const targets = SilkPublishability.detect(
  "@my-org/my-package",
  {
    name: "@my-org/my-package",
    private: true,
    publishConfig: { access: "public", targets: { npm: true, github: true } },
  },
  null, // pre-build placeholder; pass the dist/prod/targets.json binding post-build
);
// => [PublishTarget { registry: "https://registry.npmjs.org", access: "public", ... },
//     PublishTarget { registry: "https://npm.pkg.github.com", access: "public", ... }]
```

In the Silk build system, `"private": true` in the source `package.json` is normal. The builder transforms it based on `publishConfig.access` during build, so a package with `private: true` and `publishConfig.access: "public"` is publishable.

```typescript
// Not publishable -> empty array
const none = SilkPublishability.detect("@my-org/internal", { private: true }, null);
// => []
```

## Dependencies on other services

- `SilkPublishability.detect` — none (pure).
- `readTargetsBinding` — `FileSystem`.
- `SilkPublishability.resolveTargets` — `PublishabilityDetector` and `FileSystem`.
- `SilkPublishability.listPublishable` — `WorkspaceDiscovery` and `PublishabilityDetector`.
- `SilkPublishability.layer` — `FileSystem`.
- `SilkPublishability.layerAdaptive` — `FileSystem` and `ChangesetConfig`.
