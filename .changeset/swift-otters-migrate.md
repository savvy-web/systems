---
"@savvy-web/silk-effects": major
---

## Breaking Changes

### `Changesets.DepsRegen` moves to `workspaces-effect`'s point-in-time snapshots

The `Changesets` namespace no longer exports its own git-ref workspace reader. `DepsRegen` now snapshots both sides of a diff through `workspaces-effect`'s `PointInTimeWorkspace` service, which resolves `catalog:`/`workspace:` specifiers per-ref before rows are ever compared.

Removed from `@savvy-web/silk-effects` (`Changesets` namespace):

* `WorkspaceSnapshotReader`, `WorkspaceSnapshotReaderBase`, `WorkspaceSnapshotReaderLive`
* `WorkspaceSnapshot` (type), `WorkspaceSnapshotReaderShape` (type)
* `snapshotFromWorktree`
* `resolveDiffRows`

If you composed `DepsRegenLive` by hand, replace `WorkspaceSnapshotReaderLive` and `CatalogResolverLive` with `PointInTimeWorkspaceLive` (from `workspaces-effect`):

```typescript
// Before
const DepsRegenGroupLive = Changesets.DepsRegenLive.pipe(
  Layer.provide(Changesets.WorkspaceSnapshotReaderLive),
  Layer.provide(CatalogResolverLive.pipe(Layer.provide(LockfileReaderLive))),
  Layer.provide(PublishabilityDetectorLive),
);

// After
const DepsRegenGroupLive = Changesets.DepsRegenLive.pipe(
  Layer.provide(PointInTimeWorkspaceLive.pipe(Layer.provide(WorkspaceLive))),
  Layer.provide(PublishabilityDetectorLive),
  Layer.provide(ChangesetConfigLive.pipe(Layer.provide(ChangesetConfigReaderLive))),
);
```

`gitMergeBase` still exists but relocated from `Changesets.snapshotFromWorktree`'s module to `./utils/git.js` — the public export path (`Changesets.gitMergeBase`) is unchanged.

### `DepsRegen` error channels and layer requirements changed

* `plan()` now fails with `GitError | WorkspaceDiscoveryError | ChangesetIOError | PointInTimeReadError` (previously `GitError | WorkspaceDiscoveryError`).
* `execute()` now fails with `ChangesetIOError` — it was previously infallible. Write failures are loud; stale-changeset deletion stays skip-and-continue so an interrupted run stays safely re-runnable.
* `DepsRegenLive` drops its `CatalogResolver` and `WorkspaceSnapshotReader` requirements and now requires `PointInTimeWorkspace`, `ChangesetConfig`, and `FileSystem.FileSystem` in addition to `WorkspaceDiscovery` and `PublishabilityDetector`.
* `ReleasePlannerLive` gains a `FileSystem.FileSystem` requirement (its preview path now writes to a scope-managed temp directory instead of `node:fs`).

Any handler that only caught `GitError` needs to add the new tags:

```typescript
program.pipe(
  Effect.catchTags({
    GitError: handleGit,
    GitReadError: handleSnapshot,
    CatalogAssemblyError: handleSnapshot,
    WorkspaceRootNotFoundError: handleSnapshot,
    WorkspaceDiscoveryError: handleDiscovery,
    ChangesetIOError: handleIO,
  }),
);
```

### `listPublishablePackageNames` takes an explicit project root

`Changesets.listPublishablePackageNames(packages, root)` gains a required `root` parameter (the project root containing `.changeset/`), passed through to the publishability detector. Previously each package's own directory was passed, which made the adaptive detector's changeset-config lookup miss and silently classify every package as non-publishable. Pass the same workspace root you give `DepsRegen.plan`.

## Features

### `DepsRegenDefault` batteries-included layer

`Changesets.DepsRegenDefault` provides the full `DepsRegen` dependency graph with silk's opinionated defaults — point-in-time snapshots, config inspection, and the adaptive publishability detector — leaving only the platform services to supply:

```typescript
import { NodeContext } from "@effect/platform-node";
import { Layer } from "effect";
import { Changesets } from "@savvy-web/silk-effects";

const depsRegen = Changesets.DepsRegenDefault.pipe(Layer.provide(NodeContext.layer));
```

Note the layer reads git history, so it needs a `CommandExecutor`-capable platform layer (`NodeContext.layer`), not a bare filesystem layer. `DepsRegenLive` is unchanged for callers who inject their own dependencies.

### Per-ref catalog/workspace specifier resolution before diffing (#208)

The dependency diff behind `savvy changeset deps regen`/`detect` now resolves `catalog:` and `workspace:` specifiers against each ref's own catalogs and package versions *before* comparing them. A package that merely adopts a `catalog:` specifier without its resolved version changing no longer produces a row; a catalog version bump under a stable specifier now correctly produces an updated row showing the concrete `from`/`to` versions.

### Dependency-changeset gating tightened (#209)

A package is now in scope for dependency-changeset regeneration and stale-changeset cleanup when it is `publishable OR privatePackages.version` **and** not on the changeset ignore list — the ignore list wins over an explicit `--package` target. Previously only publishability was considered.

## Refactoring

Routed `DepsRegen` and `ReleasePlanner` file I/O through `@effect/platform`'s `FileSystem` instead of `node:fs` (#205, #144). `ReleasePlanner`'s preview path now uses a `Scope`-managed temp directory that is cleaned up automatically. New `ChangesetIOError` tagged error surfaces changeset file read/write/list/delete failures.
