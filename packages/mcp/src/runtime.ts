/**
 * Composes the long-lived Effect runtime layer for the MCP server.
 *
 * {@link makeSilkRuntimeLayer} builds the full service graph for ONE workspace
 * root: the `@effected/workspaces` kit layers are root-bound at layer build
 * (single-root by design), so the server resolves its project directory once
 * at startup (bin.ts) and builds the layer with that root. The layer still
 * requires the platform services (`FileSystem` + `Path` +
 * `ChildProcessSpawner`); the host supplies them via `NodeServices.layer`.
 *
 * @packageDocumentation
 */

import { ToolDiscovery } from "@effected/commands";
import { Workspaces } from "@effected/workspaces";
import {
	ChangesetConfig,
	ChangesetConfigReader,
	Changesets,
	Repos,
	SilkPublishability,
	SilkWorkspaceAnalyzer,
	Turbo,
} from "@savvy-web/silk-effects";
import type { FileSystem, Path } from "effect";
import { Effect, Layer } from "effect";
import type { ChildProcessSpawner } from "effect/unstable/process";

import type { McpServices } from "./context.js";

/**
 * Build the MCP runtime layer for a workspace root. Provides
 * `SilkWorkspaceAnalyzer`, `WorkspaceRoot`, `Turbo.TurboInspector`,
 * `Changesets.BranchAnalyzer`, `Changesets.ConfigInspector`,
 * `Changesets.ReleasePlanner`, `Changesets.DepsRegen`, `Repos.ReposManager`,
 * `Repos.ReposConfigStore`, and `Repos.ReposDrift`; requires `ChildProcessSpawner` + `FileSystem`
 * + `Path` from the host's platform layer (`NodeServices.layer` in bin.ts).
 *
 * @remarks
 * The kit graph (`Workspaces.layerWithGitAndConfigDependenciesSubprocess`)
 * mints a fresh layer reference per
 * call, so it is bound to a `const` and provided ONCE via `Layer.provideMerge`
 * — layer memoization by reference then constructs each kit service exactly
 * once and exposes `WorkspaceRoot` on the runtime. The same discipline gives
 * the whole runtime a SINGLE `ConfigInspector` (the MCP server holds one for
 * its whole process lifetime, #229 — `changeset_inspect` refreshes it before
 * every call, and `BranchAnalyzer`, `ReleasePlanner`, and `DepsRegen` all read
 * through that shared instance). `DepsRegen` is gated by silk's adaptive
 * publishability detector — provided closer than the kit graph, so it wins
 * over the kit's npm-semantics default — mirroring
 * `Changesets.makeDepsRegenDefault`'s composition ("versionable minus
 * ignored", identical to the savvy CLI).
 */
export const makeSilkRuntimeLayer = (
	cwd: string,
): Layer.Layer<McpServices, never, FileSystem.FileSystem | Path.Path | ChildProcessSpawner.ChildProcessSpawner> => {
	// One reference, one construction: WorkspaceRoot, WorkspaceDiscovery,
	// PackageManagerDetector, WorkspaceSnapshots, ChangeDetector, and Git —
	// root-bound to `cwd`. The composite is `Workspaces.layerWithGit`'s
	// service set with config-dependency hook replay in catalog assembly
	// (subprocess variant, bundle-safe), so hook-injected catalogs
	// (`catalog:effected`, `catalog:effect:peers`) resolve to their declared
	// ranges in `changeset_deps_detect` / `changeset_deps_regen` diffs instead
	// of concrete lockfile versions (#539).
	const kitGraph = Workspaces.layerWithGitAndConfigDependenciesSubprocess({ cwd });

	// ChangesetConfigReader.layer is a shared const, so every consumer below
	// memoizes onto the same reader instance. The analyzer's versioning and tag
	// classification are pure `@effected/workspaces` value operations, so the
	// reader is its only silk-side dependency.
	const analyzerDeps = ChangesetConfigReader.layer;

	/**
	 * `BranchAnalyzer` + `ReleasePlanner` + the ONE shared `ConfigInspector`,
	 * merged so all three land on the runtime and every internal consumer
	 * memoizes onto the same inspector reference.
	 */
	const inspectorAndAnalyzer = Changesets.BranchAnalyzer.layer.pipe(
		Layer.provideMerge(Changesets.ReleasePlanner.layer),
		Layer.provideMerge(Changesets.ConfigInspector.layer.pipe(Layer.provide(ChangesetConfigReader.layer))),
	);

	/**
	 * `ToolDiscovery` from `@effected/commands`, which `TurboInspector` uses to
	 * locate the `turbo` binary. Its `LocalExec` contract is implemented by
	 * `Workspaces.localExecLayer({ cwd })`, whose own requirements
	 * (`PackageManagerDetector`, `WorkspaceRoot`) come from `kitGraph` below —
	 * one reference, so the whole runtime shares a single discovery instance and
	 * its probe cache.
	 */
	const toolDiscovery = ToolDiscovery.layer.pipe(Layer.provide(Workspaces.localExecLayer({ cwd })));

	const changesetConfig = ChangesetConfig.layer.pipe(Layer.provide(ChangesetConfigReader.layer));

	const depsRegen = Changesets.DepsRegen.layer.pipe(
		Layer.provide(inspectorAndAnalyzer),
		Layer.provide(SilkPublishability.layerAdaptive.pipe(Layer.provide(changesetConfig))),
		Layer.provide(changesetConfig),
	);

	/**
	 * `ReposManager.layer` requires `ReposConfigStore | ReposLockdown`, so it is
	 * given its own `ReposConfigStore.layer` reference; the store is ALSO merged
	 * in directly so `repos_inspect`'s config mode can resolve it on its own.
	 * Same reference — one store instance. `ReposLockdown.layer` needs only the
	 * platform services, which flow up from the outer `NodeServices.layer`
	 * provision like `ReposManager`'s own `FileSystem`/`Path` requirement does.
	 * `ReposDrift.layer` is read-only (no `ReposLockdown` interaction) and
	 * requires only `ReposConfigStore | Git | FileSystem | Path`; `Git` comes
	 * from `kitGraph` below via the same one-reference discipline, and
	 * `repos_inspect`'s drift mode resolves it directly.
	 */
	const repos = Layer.mergeAll(
		Repos.ReposConfigStore.layer,
		Repos.ReposManager.layer.pipe(
			Layer.provide(Repos.ReposConfigStore.layer),
			Layer.provide(Repos.ReposLockdown.layer),
		),
		Repos.ReposDrift.layer.pipe(Layer.provide(Repos.ReposConfigStore.layer)),
	);

	// `repos_inspect`'s `gitmodules` mode reads `.gitmodules` through the
	// ambient `FileSystem`/`Path` services directly (mirroring
	// `Repos.ReposDrift.check`), so those two are passed through onto the
	// runtime's own output rather than being fully discharged by
	// `NodeServices.layer` at the host boundary (bin.ts) — both are already
	// required inputs below (via `kitGraph`/`ReposManager`/`ReposDrift`), so
	// this adds no new requirement.
	const platformPassthrough = Layer.effectContext(Effect.context<FileSystem.FileSystem | Path.Path>());

	return Layer.mergeAll(
		SilkWorkspaceAnalyzer.layer.pipe(Layer.provide(analyzerDeps)),
		Turbo.TurboInspector.layer.pipe(Layer.provide(toolDiscovery)),
		inspectorAndAnalyzer,
		depsRegen,
		repos,
		platformPassthrough,
	).pipe(Layer.provideMerge(kitGraph));
};
