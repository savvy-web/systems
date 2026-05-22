# Publishability

Determine whether a package is publishable under Silk conventions and resolve its publish targets.

## What it does

In the Silk ecosystem, `package.json` uses `publishConfig` to declare publish intent, and `private: true` is the norm on workspace packages. `SilkPublishability` applies the silk publishability rules to a raw `package.json` and returns the publish targets it resolves. A target is a `PublishTarget` record from `workspaces-effect` with `name`, `registry`, `directory`, `access` and `provenance` fields.

Three usage levels are available:

- `SilkPublishability.detect` — a pure static you call directly, no layers.
- `SilkPublishabilityDetectorLive` / `PublishabilityDetectorAdaptiveLive` — layers that override `workspaces-effect`'s `PublishabilityDetector` Tag, so silk rules flow into any program that yields the detector.
- `SilkPublishability.resolveTargets` / `SilkPublishability.listPublishable` — Effects that read from disk to filter targets and discover publishable packages.

## SilkPublishability

A class whose members are all static, so a consumer sees the full rule surface in one place.

```typescript
class SilkPublishability {
  static detect(pkgName: string, raw: RawPackageJson): ReadonlyArray<PublishTarget>;
  static expandShorthand(target: string, parentRegistry: string | undefined): string;
  static resolveTargetAccess(
    target: RawTargetSpec,
    parentAccess: "public" | "restricted" | undefined,
  ): "public" | "restricted" | undefined;
  static resolveTargets(
    pkg: WorkspacePackage,
    root: string,
  ): Effect.Effect<ReadonlyArray<PublishTarget>, never, PublishabilityDetector | FileSystem.FileSystem>;
  static listPublishable(
    root: string,
  ): Effect.Effect<ReadonlyArray<PublishablePackage>, never, WorkspaceDiscovery | PublishabilityDetector>;
}
```

### `detect(pkgName, raw)`

Apply the silk rules to a raw `package.json` and return the resolved targets. Pure — no Effect, no layers.

- **pkgName** — the package name, used to populate each `PublishTarget.name`.
- **raw** — the raw `package.json` fields silk rules consult (`RawPackageJson`).
- **Returns** — `ReadonlyArray<PublishTarget>`. Empty when the package is not publishable.

### `expandShorthand(target, parentRegistry)`

Expand a shorthand string target to a registry URL. `"npm"` → `https://registry.npmjs.org/`, `"github"` → `https://npm.pkg.github.com/`, `"jsr"` → `https://jsr.io/`. An `http(s)://…` value is used verbatim. Anything else falls back to the parent `publishConfig.registry`, then the npm default.

### `resolveTargetAccess(target, parentAccess)`

Resolve the access for one target spec. String targets always inherit the parent `publishConfig.access`; object targets use their own `.access` else the parent's.

### `resolveTargets(pkg, root)`

Resolve a package's publish targets via the `PublishabilityDetector` Tag, then drop any whose built `directory` `package.json` is `private: true`. Returned targets keep the detector's original (possibly package-relative) `directory`. Requires `PublishabilityDetector` and `FileSystem`.

### `listPublishable(root)`

The publishable, non-ignored packages in a workspace, resolved through the single `PublishabilityDetector` (which already honors changeset ignore in adaptive mode). Returns `PublishablePackage` records (`name`, `version`, `path`, `targetCount`). Requires `WorkspaceDiscovery` and `PublishabilityDetector`.

## Publishability rules

`detect` evaluates these in order. The first matching rule determines the result.

| # | Condition | Result |
| - | --------- | ------ |
| 1 | `publishConfig.targets` is a non-empty array | One `PublishTarget` per surviving target (entries whose resolved access is neither `public` nor `restricted` are skipped) |
| 2 | `publishConfig.access` is `public` or `restricted` | A single `PublishTarget` |
| 3 | `private !== true` | A single default `PublishTarget` |
| 4 | otherwise | `[]` (not publishable) |

Targets-first precedence means a `publishConfig.targets` array resolves regardless of the `private` flag. The `private` flag is consulted only as the last-resort default in rule 3.

## Detector overrides

`SilkPublishability.detect` is also exposed through `workspaces-effect`'s `PublishabilityDetector` Tag. Provide one of these layers and every consumer that yields `PublishabilityDetector` gets silk behavior.

### SilkPublishabilityDetectorLive

```typescript
export const SilkPublishabilityDetectorLive: Layer.Layer<
  PublishabilityDetector,
  never,
  FileSystem.FileSystem
>;
```

Applies silk rules unconditionally. `detect` reads the raw `package.json` from `pkg.packageJsonPath` and applies `SilkPublishability.detect`. Requires `FileSystem`.

```typescript
import { Effect } from "effect";
import { NodeContext } from "@effect/platform-node";
import { PublishabilityDetector } from "workspaces-effect";
import { SilkPublishabilityDetectorLive } from "@savvy-web/silk-effects";

const program = Effect.gen(function* () {
  const detector = yield* PublishabilityDetector;
  return yield* detector.detect(pkg, root);
}).pipe(
  Effect.provide(SilkPublishabilityDetectorLive),
  Effect.provide(NodeContext.layer),
);

const targets = await Effect.runPromise(program);
// => ReadonlyArray<PublishTarget>
```

### PublishabilityDetectorAdaptiveLive

```typescript
export const PublishabilityDetectorAdaptiveLive: Layer.Layer<
  PublishabilityDetector,
  never,
  FileSystem.FileSystem | ChangesetConfig
>;
```

Ignore-aware. `detect` short-circuits to `[]` for changeset-`ignore`d packages, then dispatches on `ChangesetConfig.mode`:

- `none` → `[]`
- `silk` → `SilkPublishability.detect`
- `vanilla` → the `workspaces-effect` library default

Requires `FileSystem` and `ChangesetConfig`. Compose it with the `ChangesetConfig` service and its reader:

```typescript
import { Effect, Layer } from "effect";
import { NodeContext } from "@effect/platform-node";
import { PublishabilityDetector } from "workspaces-effect";
import {
  ChangesetConfig, ChangesetConfigLive, ChangesetConfigReaderLive,
  PublishabilityDetectorAdaptiveLive,
} from "@savvy-web/silk-effects";

const layer = Layer.mergeAll(
  PublishabilityDetectorAdaptiveLive.pipe(Layer.provide(ChangesetConfigLive)),
  ChangesetConfigLive,
  ChangesetConfigReaderLive,
).pipe(Layer.provide(NodeContext.layer));

const program = Effect.gen(function* () {
  const detector = yield* PublishabilityDetector;
  return yield* detector.detect(pkg, root);
}).pipe(Effect.provide(layer));

const targets = await Effect.runPromise(program);
// => ReadonlyArray<PublishTarget>
```

## Related types

```typescript
// A single declared publish target in a raw publishConfig.targets array
type RawTargetSpec =
  | string
  | {
      readonly access?: "public" | "restricted";
      readonly protocol?: string;
      readonly registry?: string;
      readonly directory?: string;
      readonly provenance?: boolean;
    };

// The raw publishConfig fields silk rules consult
interface RawPublishConfig {
  readonly access?: "public" | "restricted";
  readonly registry?: string;
  readonly directory?: string;
  readonly targets?: ReadonlyArray<RawTargetSpec>;
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

`PublishTarget` comes from `workspaces-effect` (import it from there) and carries `name`, `registry`, `directory`, `access` and `provenance`.

## Usage

```typescript
import { SilkPublishability } from "@savvy-web/silk-effects";

// Targets-first: one PublishTarget per publishConfig.targets entry
const targets = SilkPublishability.detect("@my-org/my-package", {
  name: "@my-org/my-package",
  private: true,
  publishConfig: { access: "public", targets: ["npm", "github"] },
});
// => [PublishTarget { registry: "https://registry.npmjs.org/", access: "public", ... },
//     PublishTarget { registry: "https://npm.pkg.github.com/", access: "public", ... }]
```

In the Silk build system, `"private": true` in the source `package.json` is normal. The builder transforms it based on `publishConfig.access` during build, so a package with `private: true` and `publishConfig.access: "public"` is publishable.

```typescript
// Not publishable -> empty array
const none = SilkPublishability.detect("@my-org/internal", { private: true });
// => []
```

## Dependencies on other services

- `SilkPublishability.detect`, `expandShorthand`, `resolveTargetAccess` — none (pure).
- `SilkPublishability.resolveTargets` — `PublishabilityDetector` and `FileSystem`.
- `SilkPublishability.listPublishable` — `WorkspaceDiscovery` and `PublishabilityDetector`.
- `SilkPublishabilityDetectorLive` — `FileSystem`.
- `PublishabilityDetectorAdaptiveLive` — `FileSystem` and `ChangesetConfig`.
