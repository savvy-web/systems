# @savvy-web/silk-effects

## 0.1.0

### Features

* [`d553939`](https://github.com/savvy-web/systems/commit/d5539392f70a56ada8b035313fa2d11c98fa5bde) Introduces `@savvy-web/silk-effects`, a platform-agnostic Effect library that consolidates shared Silk Suite conventions into a single package consumed across the ecosystem. The library is built on `@effect/platform` and requires `effect` as a peer dependency -- consumers supply their own platform layer.

### Publish -- Multi-Registry Target Resolution

The `./publish` module resolves raw publish-target values into fully-normalized `ResolvedTarget` records. Supported input forms are the shorthand strings `"npm"`, `"github"`, and `"jsr"`, arbitrary `https://` registry URLs, and structured `PublishTargetObject` values. Auth strategy (`oidc` vs `token`) and token environment variable names are derived automatically from the registry URL.

The module also ships `SilkPublishabilityPlugin`, a plugin for `workspaces-effect` that detects whether a workspace package is publishable by inspecting `publishConfig.access` and `private` fields.

```typescript
import {
  TargetResolver,
  TargetResolverLive,
} from "@savvy-web/silk-effects/publish";

const targets = await Effect.runPromise(
  Effect.gen(function* () {
    const resolver = yield* TargetResolver;
    return yield* resolver.resolve(["npm", "github"]);
  }).pipe(Effect.provide(TargetResolverLive)),
);
```

### Versioning -- Changeset Config Reading and Strategy Detection

The `./versioning` module reads `.changeset/config.json` files via `ChangesetConfigReader` and detects whether the config uses Silk-specific extensions (`SilkChangesetConfig`). `VersioningStrategy` maps the config to one of three strategy types: `"single"` (one package), `"fixed-group"` (changesets `fixed` array present), or `"independent"`.

### Tags -- Git Tag Format Determination

The `./tags` module provides `TagStrategy`, which determines whether a repository should use single version tags (`1.2.3`) or scoped package tags (`@scope/pkg@1.2.3`) based on the workspace layout and versioning strategy. The `TagStrategyType` union (`"single" | "scoped"`) is exported for consumers that need to branch on the result.

### Hooks -- Managed Section Pattern for Tool-Owned File Regions

The `./hooks` module implements the managed section pattern: tool-owned regions delimited by `BEGIN {TOOL_NAME} MANAGED SECTION` / `END {TOOL_NAME} MANAGED SECTION` markers inside user-editable files. `ManagedSection` exposes `read`, `write`, `update`, and `isManaged` operations that preserve everything outside the markers while replacing managed content. Comment style (`"#"` or `"//"`) is configurable.

### Config -- Config File Discovery with `lib/configs/` Priority

The `./config` module provides `ConfigDiscovery`, which locates config files using a two-level search. When a `lib/configs/` directory contains the target file, it takes priority over the repo root -- the Silk convention for centralizing shared configs in a workspace. The resolved `ConfigLocation` includes both the file path and the `ConfigSource` (`"lib" | "root"`).

### Biome -- `$schema` URL Synchronization

The `./biome` module provides `BiomeSchemaSync`, which scans `biome.json` and `biome.jsonc` files in the working directory and updates their `$schema` field to point to the canonical versioned URL for the target Biome release. `BiomeSyncResult` reports each file as `updated`, `current`, or `skipped`.
