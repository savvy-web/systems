---
id: packages/silk-effects/api/class/silkpublishability
title: "SilkPublishability — silk-effects class"
summary: "Silk publishability rules over `workspaces-effect`'s PublishTarget."
tier: packages
source: generated
tags: [silk-effects, api]
priority: 0.3
related: []
---

# SilkPublishability

Silk publishability rules over `workspaces-effect`'s PublishTarget.

```ts
class SilkPublishability
```

## Members

### detect

```ts
static detect(pkgName: string, raw: RawPackageJson): ReadonlyArray<PublishTarget>;
```

Apply silk publishability rules to a raw `package.json`. Targets-first precedence: `publishConfig.targets` → one PublishTarget per surviving target (regardless of `private`); else `publishConfig.access` → one target; else `private !== true` → one default target; else `[]`.

### expandShorthand

```ts
static expandShorthand(target: string, parentRegistry: string | undefined): string;
```

Expand a shorthand string target to a registry URL. `"npm"`/`"github"`/`"jsr"` map to canonical registries; `http(s)://…` is verbatim; anything else falls back to the parent `publishConfig.registry` (or the npm default).

### listPublishable

```ts
static listPublishable(root: string): Effect.Effect<ReadonlyArray<PublishablePackage>, never, WorkspaceDiscovery |
  PublishabilityDetector>;
```

The publishable, non-ignored packages, resolved through the single PublishabilityDetector (which already honors changeset ignore in adaptive mode).

### resolveTargetAccess

```ts
static resolveTargetAccess(target: RawTargetSpec, parentAccess: "public" | "restricted" | undefined): "public" | "restricted" | undefined;
```

Resolve the access for one target spec. String targets always inherit the parent `publishConfig.access`; object targets use their own `.access` else the parent's.

### resolveTargets

```ts
static resolveTargets(pkg: WorkspacePackage, root: string): Effect.Effect<ReadonlyArray<PublishTarget>, never, PublishabilityDetector |
  FileSystem.FileSystem>;
```

Resolve a package's publish targets via PublishabilityDetector, then drop any whose built `directory` package.json is `private: true`. Returned targets keep the detector's original (possibly package-relative) `directory`.
