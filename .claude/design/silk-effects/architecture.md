---
name: silk-effects-architecture
title: "@savvy-web/silk-effects Architecture"
module: silk-effects
category: architecture
status: current
completeness: 90
last-synced: 2026-03-28
depends-on: []
---

## Table of Contents

- [Overview](#overview)
- [Current State](#current-state)
- [Module Architecture](#module-architecture)
- [Service Patterns](#service-patterns)
- [Dependencies](#dependencies)
- [Consumer Guide](#consumer-guide)
- [Rationale](#rationale)

## Overview

`@savvy-web/silk-effects` is a platform-agnostic Effect library providing Silk Suite-specific
conventions. It extracts repeated patterns from across the ecosystem into a single shared
package consumed by ~33 repositories.

The library builds on top of foundation libraries (`workspaces-effect`, `semver-effect`,
`jsonc-effect`, `yaml-effect`) to provide higher-level, Silk-opinionated behavior for
publishability detection, versioning strategy, tag formatting, managed sections, config
discovery, and Biome schema synchronization.

**Package:** `@savvy-web/silk-effects`
**Location:** `packages/silk-effects` in `savvy-web/systems`
**Runtime:** Platform-agnostic via `@effect/platform` — consumers provide their platform layer

## Current State

v0.1.0 — all 6 modules implemented with full test coverage:

| Module | Export | Services | Tests |
| ------ | ------ | -------- | ----- |
| Publish | `./publish` | `TargetResolver`, `SilkPublishabilityPlugin` | 56 |
| Versioning | `./versioning` | `ChangesetConfigReader`, `VersioningStrategy` | 20 |
| Tags | `./tags` | `TagStrategy` | 7 |
| Hooks | `./hooks` | `ManagedSection` | 20 |
| Config | `./config` | `ConfigDiscovery` | 9 |
| Biome | `./biome` | `BiomeSchemaSync` | 19 |

Total: 131 tests, all passing.

## Module Architecture

### Publish (`./publish`)

Multi-registry target resolution and publishability detection.

```text
PublishTarget (schema)          ResolvedTarget (schema)
  string | object       →       { protocol, registry, directory,
                                  access, provenance, tag, auth, tokenEnv }

TargetResolver (service)
  resolve(target) → ResolvedTarget[]

SilkPublishabilityPlugin (service)
  detect(pkgJson) → ResolvedTarget[]
  Depends on: TargetResolver
```

**Shorthand expansion:**

- `"npm"` → npmjs.org, OIDC auth
- `"github"` → npm.pkg.github.com, token auth (`GITHUB_TOKEN`)
- `"jsr"` → JSR, OIDC auth
- `"https://..."` → custom registry, token auth (derived from hostname)
- `{ protocol, registry, ... }` → pass-through with defaults

**Publishability rules:**

1. `private: true` + no `publishConfig` → not publishable
2. No `publishConfig.access` and no `publishConfig.targets` → not publishable
3. Has `publishConfig.targets` array → resolve each target
4. Has `publishConfig.registry` → resolve single target
5. Default → resolve `"npm"` shorthand

### Versioning (`./versioning`)

Changeset configuration reading with Silk detection, and versioning strategy determination.

```text
ChangesetConfigReader (service)
  read(root) → ChangesetConfig | SilkChangesetConfig
  Depends on: FileSystem

VersioningStrategy (service)
  detect(publishablePackages) → VersioningStrategyResult
  Depends on: ChangesetConfigReader
```

**Config layering:**

- `ChangesetConfig` — matches upstream `@changesets/types` spec
- `SilkChangesetConfig` — extends with `_isSilk: true` when `changelog` field
  references `@savvy-web/changesets`

**Strategy types:**

- `"single"` — 0-1 publishable packages
- `"fixed-group"` — all publishable packages in one `fixed` group
- `"independent"` — multiple packages not in a single fixed group

### Tags (`./tags`)

Git tag format determination based on versioning strategy.

```text
TagStrategy (service)
  determine(versioningResult) → "single" | "scoped"
  formatTag(name, version, strategy) → string
```

**Tag formats:**

- Single: `1.2.3` (strict SemVer 2.0.0, no `v` prefix)
- Scoped + `@scope/pkg`: `@scope/pkg@1.2.3`
- Scoped + unscoped: `my-pkg@1.2.3`

### Hooks (`./hooks`)

Managed section pattern for tool-owned regions in user-editable files.

```text
ManagedSection (service)
  read(path, toolName) → { before, managed, after } | null
  write(path, toolName, content) → void
  update(path, toolName, content) → void
  isManaged(path, toolName) → boolean
  Depends on: FileSystem
```

**Marker format:**

```text
# --- BEGIN {TOOL_NAME} MANAGED SECTION ---
managed content here
# --- END {TOOL_NAME} MANAGED SECTION ---
```

Supports `#` and `//` comment styles. Preserves user content outside markers.

### Config (`./config`)

Config file discovery following the Silk convention.

```text
ConfigDiscovery (service)
  find(name, options?) → { path, source } | null
  findAll(name, options?) → { path, source }[]
  Depends on: FileSystem
```

**Search priority:**

1. `{cwd}/lib/configs/{name}` → source: `"lib"`
2. `{cwd}/{name}` → source: `"root"`

### Biome (`./biome`)

Version-aware Biome schema URL synchronization.

```text
BiomeSchemaSync (service)
  sync(version, options?) → { updated, skipped, current }
  check(version, options?) → { updated, skipped, current }
  Depends on: FileSystem
```

Scans for `biome.json` / `biome.jsonc`, compares `$schema` URL against expected
version, and optionally updates in place. Strips semver range prefixes (`^`, `~`, `>=`).

## Service Patterns

All services follow the same Effect-TS patterns:

### Service Definition

```typescript
export class ServiceName extends Context.Tag("@savvy-web/silk-effects/ServiceName")<
  ServiceName,
  { readonly method: (...) => Effect.Effect<Result, ErrorType> }
>() {}
```

### Layer Implementation

```typescript
// Pure service (no dependencies)
export const ServiceLive = Layer.succeed(ServiceName, { ... });

// Service with dependencies
export const ServiceLive = Layer.effect(ServiceName, Effect.gen(function* () {
  const dep = yield* DependencyTag;
  return ServiceName.of({ ... });
}));
```

### Error Types

```typescript
export class ModuleError extends Data.TaggedError("ModuleError")<{
  readonly field: string;
}> {
  get message() { return `Description: ${this.field}`; }
}
```

### Schema Types

```typescript
export const SchemaName = Schema.Struct({ ... });
export type SchemaName = typeof SchemaName.Type;
```

## Dependencies

```text
@savvy-web/silk-effects
  ├── effect (peer)
  ├── @effect/platform (direct)
  ├── workspaces-effect (direct)
  ├── semver-effect (direct)
  ├── jsonc-effect (direct)
  └── yaml-effect (direct)
```

**Runtime requirement:** Consumers must provide a platform layer (`NodeContext.layer`,
`BunContext.layer`, etc.) for modules that use `FileSystem`.

**Modules requiring FileSystem:**

- hooks/ManagedSection
- config/ConfigDiscovery
- biome/BiomeSchemaSync
- versioning/ChangesetConfigReader

**Pure modules (no FileSystem):**

- publish/TargetResolver
- publish/SilkPublishabilityPlugin (delegates to TargetResolver)
- tags/TagStrategy

## Consumer Guide

### Installation

```bash
pnpm add @savvy-web/silk-effects effect @effect/platform @effect/platform-node
```

### Usage

```typescript
import { Effect } from "effect";
import { NodeContext } from "@effect/platform-node";
import { TargetResolver, TargetResolverLive } from "@savvy-web/silk-effects/publish";

const result = await Effect.runPromise(
  Effect.gen(function* () {
    const resolver = yield* TargetResolver;
    return yield* resolver.resolve(["npm", "github"]);
  }).pipe(
    Effect.provide(TargetResolverLive),
  )
);
```

For FileSystem-dependent services:

```typescript
import { ManagedSection, ManagedSectionLive } from "@savvy-web/silk-effects/hooks";

const result = await Effect.runPromise(
  Effect.gen(function* () {
    const ms = yield* ManagedSection;
    yield* ms.write(".husky/pre-commit", "MY-TOOL", "\nnpx lint-staged\n");
  }).pipe(
    Effect.provide(ManagedSectionLive),
    Effect.provide(NodeContext.layer),
  )
);
```

### Selective Imports

Each module has its own entry point — import only what you need:

```typescript
import { TargetResolver } from "@savvy-web/silk-effects/publish";
import { ManagedSection } from "@savvy-web/silk-effects/hooks";
import { BiomeSchemaSync } from "@savvy-web/silk-effects/biome";
```

## Rationale

### Why platform-agnostic?

The library is consumed by GitHub Actions (Node.js), CLI tools (Node.js), and potentially
Bun-based tools. Using `@effect/platform` abstractions ensures compatibility across all
runtimes without requiring separate implementations.

### Why extract these patterns?

These 6 patterns were independently implemented in 3-6 repos each. Extracting them
eliminates duplication, ensures consistent behavior, and provides a single point for
version-bumping the shared logic.

### Why `effect` as a peer dependency?

Consumers already depend on `effect`. Bundling it would cause version conflicts and
bloated output. As a peer, consumers get a single copy.

### Why layered changeset config?

`ChangesetConfig` matches the upstream `@changesets/types` spec so the module works with
any changesets project. `SilkChangesetConfig` extends it for Silk-specific features without
breaking compatibility.
