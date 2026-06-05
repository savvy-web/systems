import { NodeContext } from "@effect/platform-node";
import { Effect } from "effect";
import type { ManifestLike } from "workspaces-effect";
import { CatalogResolver, WorkspacesLive } from "workspaces-effect";

export type { ManifestLike } from "workspaces-effect";

/**
 * Resolve every `catalog:`/`workspace:` specifier in a manifest to a concrete spec,
 * delegating to workspaces-effect's CatalogResolver. The resolver discovers the
 * workspace root from `process.cwd()` (run this from inside the target workspace)
 * and assembles catalogs durably (inline + config-dependency hook-replay + lockfile),
 * so no transient `.pnpm-workspace-state-v1.json` is required.
 *
 * Rejects with `CatalogResolutionError` on an unresolvable reference, or
 * `CatalogAssemblyError` if the workspace catalog set cannot be assembled.
 */
export function resolveManifest(pkg: ManifestLike): Promise<ManifestLike> {
	const program = Effect.gen(function* () {
		const resolver = yield* CatalogResolver;
		return yield* resolver.resolve(pkg);
	});
	return Effect.runPromise(program.pipe(Effect.provide(WorkspacesLive), Effect.provide(NodeContext.layer)));
}
