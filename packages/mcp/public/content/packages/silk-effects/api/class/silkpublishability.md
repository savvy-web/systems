---
id: packages/silk-effects/api/class/silkpublishability
title: "SilkPublishability — silk-effects class"
summary: "Silk publishability rules over `workspaces-effect`'s `PublishTarget`."
tier: packages
source: generated
tags: [silk-effects, api]
priority: 0.3
related: []
---

# SilkPublishability

Silk publishability rules over `workspaces-effect`'s `PublishTarget`.

```ts
class SilkPublishability
```

## Members

### detect

```ts
static detect(pkgName: string, raw: RawPackageJson, binding: TargetsBinding | null): ReadonlyArray<PublishTarget>;
```

Apply silk publishability rules to a raw `package.json` and the bundler's resolved target binding. Targets-first precedence: - A non-empty `publishConfig.targets` map (the bundler's Record-map form) makes the package publishable regardless of `private`. With a `binding` (post-prod-build), one `PublishTarget` is emitted per resolved registry target, its `directory` set to the bound group's `dist/prod/<group>/pkg` dir. Without a binding (pre-build), one placeholder target is emitted per declared key so publishability and target counts are correct; the directory is best-effort and unused until the build writes the binding. - Else `publishConfig.access` → one target at `publishConfig.directory`. - Else `private !== true` → one default public target. - Else `[]`.

### listPublishable

```ts
static listPublishable(root: string): Effect.Effect<ReadonlyArray<PublishablePackage>, never, WorkspaceDiscovery |
  PublishabilityDetector>;
```

The publishable, non-ignored packages, resolved through the single [SilkPublishability](silk://packages/silk-effects/api/class/silkpublishability) (which already honors changeset ignore in adaptive mode).

### resolveTargets

```ts
static resolveTargets(pkg: WorkspacePackage, root: string): Effect.Effect<ReadonlyArray<PublishTarget>, never, PublishabilityDetector |
  FileSystem.FileSystem>;
```

Resolve a package's publish targets via [SilkPublishability](silk://packages/silk-effects/api/class/silkpublishability), then drop any whose built `directory` package.json is `private: true`. Returned targets keep the detector's original (possibly package-relative) `directory`.
