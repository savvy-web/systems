import { getReleasePlan } from "@changesets/get-release-plan";
import { NodeFileSystem, NodePath } from "@effect/platform-node";
import { WorkspaceDiscovery, Workspaces } from "@effected/workspaces";
import { Effect, Layer } from "effect";

/**
 * Result of resolving next release versions for a workspace.
 *
 * @public
 */
export interface NextVersions {
	/** Monorepo root containing `.changeset/` (or `cwd` when no workspace was found). */
	readonly root: string;
	/** Canonical package name `->` next release version (current version when unbumped). */
	readonly versions: ReadonlyMap<string, string>;
}

/** Bound once: the platform layer is stateless and layers memoize by reference. */
const platform = Layer.mergeAll(NodeFileSystem.layer, NodePath.layer);

/**
 * Resolve the next release version of every workspace package from pending changesets.
 *
 * Walks up from `cwd` to the monorepo root via `@effected/workspaces`' `WorkspaceDiscovery`,
 * seeds the map with each package's CURRENT version, then overlays `newVersion` for
 * changeset-affected packages via `@changesets/get-release-plan`. Never rejects: any failure
 * (not a workspace, missing `.changeset/config.json`, parse error) degrades to current
 * versions (or an empty map).
 * @public
 */
export async function resolveNextVersions(cwd: string): Promise<NextVersions> {
	try {
		const packages = await Effect.runPromise(
			Effect.gen(function* () {
				const discovery = yield* WorkspaceDiscovery;
				return yield* discovery.listPackages();
			}).pipe(
				// A fresh composite layer per call: `cwd` differs per invocation and layers
				// memoize by reference, so root discovery must not be shared across calls.
				Effect.provide(Workspaces.layer({ cwd }).pipe(Layer.provide(platform))),
			),
		);
		// listPackages is root-first; the root package's path is the monorepo root.
		const rootDir = packages[0]?.isRootWorkspace ? packages[0].path : cwd;
		const versions = new Map<string, string>();
		for (const p of packages) {
			// Parity with the previous @manypkg/get-packages behavior: the root package was
			// never part of packages[] and therefore never seeded into the versions map.
			if (p.isRootWorkspace) continue;
			versions.set(p.name, p.version);
		}
		try {
			const plan = await getReleasePlan(rootDir);
			// plan.releases includes type:"none" entries (unbumped dependents) whose newVersion equals
			// the current version, so overlaying every release is safe.
			for (const r of plan.releases) versions.set(r.name, r.newVersion);
		} catch {
			// No `.changeset/config.json` (or unreadable): keep current versions.
		}
		return { root: rootDir, versions };
	} catch {
		// Not a workspace / cannot enumerate packages: optimistic becomes a full no-op.
		return { root: cwd, versions: new Map() };
	}
}
