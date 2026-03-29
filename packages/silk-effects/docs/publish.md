# Publish Module

[Back to README](../README.md)

Multi-registry target resolution and publishability detection for Silk Suite packages.

```typescript
import {
  TargetResolver, TargetResolverLive,
  SilkPublishabilityPlugin, SilkPublishabilityPluginLive,
} from "@savvy-web/silk-effects/publish";
```

## Table of Contents

- [Overview](#overview)
- [Services](#services)
- [Shorthand Expansion](#shorthand-expansion)
- [Publishability Rules](#publishability-rules)
- [Schemas](#schemas)
- [Errors](#errors)
- [Examples](#examples)

## Overview

The publish module converts shorthand target identifiers (like `"npm"` or `"github"`) into fully resolved target records containing registry URLs, authentication strategy, directory paths, and provenance settings. It also inspects `package.json` to determine whether a package is publishable and which registries it targets.

Neither service requires a platform layer -- all logic is pure.

## Services

### TargetResolver

Resolves raw publish-target values into fully normalised `ResolvedTarget` records.

```typescript
class TargetResolver {
  readonly resolve: (
    target: unknown,
  ) => Effect.Effect<ReadonlyArray<ResolvedTarget>, TargetResolutionError>;
}
```

Accepts a single target or an array of targets. Each item may be a shorthand string (`"npm"`, `"github"`, `"jsr"`), an `https://` registry URL, or a `PublishTargetObject`.

**Layer:** `TargetResolverLive` -- no dependencies.

### SilkPublishabilityPlugin

Determines whether a package is publishable and resolves its targets.

```typescript
class SilkPublishabilityPlugin {
  readonly detect: (
    pkgJson: Record<string, unknown>,
  ) => Effect.Effect<ReadonlyArray<ResolvedTarget>, TargetResolutionError>;
}
```

Inspects a parsed `package.json` object and returns an array of resolved targets (empty when the package is not publishable).

**Layer:** `SilkPublishabilityPluginLive` -- requires `TargetResolverLive`.

## Shorthand Expansion

| Shorthand | Registry | Auth | Token Env |
| --------- | -------- | ---- | --------- |
| `"npm"` | `https://registry.npmjs.org/` | OIDC | n/a |
| `"github"` | `https://npm.pkg.github.com/` | Token | `GITHUB_TOKEN` |
| `"jsr"` | JSR | OIDC | n/a |
| `"https://..."` | Custom URL | Token | Derived from hostname |

When a custom URL is provided, the token environment variable name is derived by uppercasing the hostname and replacing dots with underscores, prefixed with `NPM_TOKEN_`. For example, `https://registry.example.com/` becomes `NPM_TOKEN_REGISTRY_EXAMPLE_COM`.

Object targets are passed through with defaults applied:

| Field | Default |
| ----- | ------- |
| `protocol` | `"npm"` |
| `directory` | `"dist/npm"` |
| `access` | `"public"` |
| `provenance` | `false` |
| `tag` | `"latest"` |

## Publishability Rules

`SilkPublishabilityPlugin.detect` applies these rules in order:

1. `private: true` with no `publishConfig` -- not publishable (returns `[]`).
2. No `publishConfig.access` and no `publishConfig.targets` -- not publishable (returns `[]`).
3. `publishConfig.targets` is an array -- resolve each target via `TargetResolver`.
4. `publishConfig.registry` is set -- resolve as a single registry target.
5. Default -- resolve the `"npm"` shorthand.

## Schemas

### PublishTarget

Union of all accepted target representations:

- `PublishTargetShorthand` -- `"npm" | "github" | "jsr"`
- An `https://` URL string pointing to a custom registry
- `PublishTargetObject` -- structured object with optional fields

### ResolvedTarget

Fully resolved target with all fields populated:

```typescript
type ResolvedTarget = {
  protocol: "npm" | "jsr";
  registry: string | null;
  directory: string;
  access: "public" | "restricted";
  provenance: boolean;
  tag: string;
  auth: "oidc" | "token";
  tokenEnv: string | null;
};
```

### PublishTargetObject

```typescript
type PublishTargetObject = {
  protocol?: "npm" | "jsr";   // default: "npm"
  registry?: string;
  directory?: string;
  access?: "public" | "restricted";
  provenance?: boolean;
  tag?: string;
};
```

## Errors

### TargetResolutionError

Raised when a target value cannot be resolved. Contains `target` (the offending input) and `reason`.

```typescript
class TargetResolutionError extends Data.TaggedError("TargetResolutionError")<{
  readonly target: unknown;
  readonly reason: string;
}> {}
```

### PublishConfigError

Raised when `publishConfig` is present but invalid. Contains `packageName` and `reason`.

## Examples

### Resolve a single shorthand

```typescript
import { Effect } from "effect";
import { TargetResolver, TargetResolverLive } from "@savvy-web/silk-effects/publish";

const targets = await Effect.runPromise(
  Effect.gen(function* () {
    const resolver = yield* TargetResolver;
    return yield* resolver.resolve("npm");
  }).pipe(Effect.provide(TargetResolverLive)),
);
// [{ protocol: "npm", registry: "https://registry.npmjs.org/", auth: "oidc", ... }]
```

### Resolve multiple targets

```typescript
import { Effect } from "effect";
import { TargetResolver, TargetResolverLive } from "@savvy-web/silk-effects/publish";

const targets = await Effect.runPromise(
  Effect.gen(function* () {
    const resolver = yield* TargetResolver;
    return yield* resolver.resolve(["npm", "github"]);
  }).pipe(Effect.provide(TargetResolverLive)),
);
// Two ResolvedTarget records: one for npmjs, one for GitHub Packages
```

### Detect publishability from package.json

```typescript
import { Effect } from "effect";
import {
  SilkPublishabilityPlugin, SilkPublishabilityPluginLive,
  TargetResolverLive,
} from "@savvy-web/silk-effects/publish";

const targets = await Effect.runPromise(
  Effect.gen(function* () {
    const plugin = yield* SilkPublishabilityPlugin;
    return yield* plugin.detect({
      name: "@my-org/my-package",
      private: true,
      publishConfig: {
        access: "public",
        targets: ["npm", "github"],
      },
    });
  }).pipe(
    Effect.provide(SilkPublishabilityPluginLive),
    Effect.provide(TargetResolverLive),
  ),
);
// Two ResolvedTarget records
```

### Handle resolution errors

```typescript
import { Effect } from "effect";
import {
  TargetResolver, TargetResolverLive, TargetResolutionError,
} from "@savvy-web/silk-effects/publish";

const result = await Effect.runPromise(
  Effect.gen(function* () {
    const resolver = yield* TargetResolver;
    return yield* resolver.resolve("unknown-registry");
  }).pipe(
    Effect.catchTag("TargetResolutionError", (err) =>
      Effect.succeed({ error: err.reason }),
    ),
    Effect.provide(TargetResolverLive),
  ),
);
```
