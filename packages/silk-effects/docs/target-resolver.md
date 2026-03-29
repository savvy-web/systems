# TargetResolver

Resolves raw publish-target values into fully-normalized `ResolvedTarget` records.

**Platform layer:** None (pure service, no I/O)

**Since:** 0.1.0

## What It Does

The Silk ecosystem supports publishing packages to multiple registries (npm,
GitHub Packages, JSR, custom registries). Rather than requiring every consumer
to spell out full registry configuration, `TargetResolver` accepts shorthand
strings, HTTPS URLs, or structured objects and expands them into complete
`ResolvedTarget` records with all defaults applied.

## Service API

```typescript
class TargetResolver extends Context.Tag("@savvy-web/silk-effects/TargetResolver")<
  TargetResolver,
  {
    readonly resolve: (
      target: unknown,
    ) => Effect.Effect<ReadonlyArray<ResolvedTarget>, TargetResolutionError>;
  }
>() {}
```

### `resolve(target)`

Resolve one target (or an array of targets) into an array of `ResolvedTarget` records.

- **target** -- A single publish-target value or an array of them. Accepts:
  - `"npm"` -- npmjs.org, OIDC auth
  - `"github"` -- npm.pkg.github.com, token auth (`GITHUB_TOKEN`)
  - `"jsr"` -- JSR registry, OIDC auth
  - `"https://..."` -- custom npm-compatible registry, token auth (env var derived from hostname)
  - `{ protocol, registry, directory, access, provenance, tag }` -- full object with defaults
- **Returns** -- `Effect<ReadonlyArray<ResolvedTarget>, TargetResolutionError>`

## Layer

```typescript
export const TargetResolverLive: Layer.Layer<TargetResolver>;
```

No dependencies. All resolution logic is pure.

## Related Types

### ResolvedTarget

Fully resolved publish target with all fields populated:

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

**Defaults applied:**

| Field | Default |
| ----- | ------- |
| `directory` | `"dist/npm"` |
| `access` | `"public"` |
| `provenance` | `false` |
| `tag` | `"latest"` |

### PublishTarget

Union of all accepted input representations:

```typescript
type PublishTarget = PublishTargetShorthand | string | PublishTargetObject;
```

### PublishTargetShorthand

```typescript
type PublishTargetShorthand = "npm" | "github" | "jsr";
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

### AuthStrategy

```typescript
type AuthStrategy = "oidc" | "token";
```

### PublishProtocol

```typescript
type PublishProtocol = "npm" | "jsr";
```

## Shorthand Expansion

| Shorthand | Protocol | Registry | Auth | Token Env |
| --------- | -------- | -------- | ---- | --------- |
| `"npm"` | `npm` | `https://registry.npmjs.org/` | `oidc` | `null` |
| `"github"` | `npm` | `https://npm.pkg.github.com/` | `token` | `GITHUB_TOKEN` |
| `"jsr"` | `jsr` | `null` | `oidc` | `null` |

Custom HTTPS URLs use `token` auth with an environment variable derived from
the hostname: `NPM_TOKEN_{HOSTNAME_UPPER}` (dots replaced with underscores).

Object targets with a GitHub Packages registry URL automatically get `token`
auth with `GITHUB_TOKEN`. All other object targets default to `oidc` auth.

## Error Types

### TargetResolutionError

Raised when a target value cannot be resolved.

```typescript
class TargetResolutionError extends Data.TaggedError("TargetResolutionError")<{
  readonly target: unknown;
  readonly reason: string;
}> {}
```

## Usage

```typescript
import { Effect } from "effect";
import { TargetResolver, TargetResolverLive } from "@savvy-web/silk-effects";

// Resolve a single shorthand
const program = Effect.gen(function* () {
  const resolver = yield* TargetResolver;
  return yield* resolver.resolve("npm");
});

const targets = await Effect.runPromise(
  program.pipe(Effect.provide(TargetResolverLive)),
);
// => [{ protocol: "npm", registry: "https://registry.npmjs.org/", ... }]
```

```typescript
// Resolve multiple targets at once
const program = Effect.gen(function* () {
  const resolver = yield* TargetResolver;
  return yield* resolver.resolve(["npm", "github"]);
});

const targets = await Effect.runPromise(
  program.pipe(Effect.provide(TargetResolverLive)),
);
// => [{ registry: "https://registry.npmjs.org/", ... }, { registry: "https://npm.pkg.github.com/", ... }]
```

## Dependencies on Other Services

None. `TargetResolver` is a leaf service with no dependencies.
