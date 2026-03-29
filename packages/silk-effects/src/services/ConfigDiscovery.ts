import { FileSystem } from "@effect/platform";
import { Context, Effect, Layer } from "effect";
import type { ConfigLocation } from "../schemas/ConfigDiscoverySchemas.js";

/**
 * Service that locates named config files within a workspace using priority-ordered search paths.
 *
 * @remarks
 * Search priority (highest to lowest):
 * 1. `lib/configs/{name}` — shared config provided by a dependency package.
 * 2. `{cwd}/{name}` — local override at the workspace root.
 *
 * Missing files are silently skipped; only files that actually exist are returned.
 *
 * @example
 * ```typescript
 * const result = await Effect.runPromise(
 *   Effect.gen(function* () {
 *     const discovery = yield* ConfigDiscovery;
 *     return yield* discovery.find("biome.json");
 *   }).pipe(
 *     Effect.provide(ConfigDiscoveryLive),
 *     Effect.provide(NodeContext.layer),
 *   )
 * );
 * ```
 *
 * @since 0.1.0
 */
export class ConfigDiscovery extends Context.Tag("@savvy-web/silk-effects/ConfigDiscovery")<
	ConfigDiscovery,
	{
		/**
		 * Return the highest-priority {@link ConfigLocation} for the given config file name,
		 * or `null` when none of the candidate paths exist.
		 *
		 * @param name - Config file name (e.g. `"biome.json"`).
		 * @param options - Optional `cwd` override for path resolution.
		 * @returns An `Effect` that always succeeds with a {@link ConfigLocation} or `null`.
		 *
		 * @since 0.1.0
		 */
		readonly find: (name: string, options?: { cwd?: string }) => Effect.Effect<ConfigLocation | null>;

		/**
		 * Return all existing {@link ConfigLocation} entries for the given config file name,
		 * ordered from highest to lowest priority.
		 *
		 * @param name - Config file name (e.g. `"biome.json"`).
		 * @param options - Optional `cwd` override for path resolution.
		 * @returns An `Effect` that always succeeds with an array of {@link ConfigLocation} records.
		 *
		 * @since 0.1.0
		 */
		readonly findAll: (name: string, options?: { cwd?: string }) => Effect.Effect<ReadonlyArray<ConfigLocation>>;
	}
>() {}

/**
 * Check whether a path exists, treating any PlatformError as "not found".
 */
function safeExists(fs: FileSystem.FileSystem, path: string): Effect.Effect<boolean> {
	return fs.exists(path).pipe(Effect.orElseSucceed(() => false));
}

/**
 * Live implementation of {@link ConfigDiscovery}.
 *
 * @remarks
 * Requires `FileSystem` from `@effect/platform`. Provide `NodeContext.layer` or
 * `BunContext.layer` to satisfy this dependency.
 *
 * @since 0.1.0
 */
export const ConfigDiscoveryLive: Layer.Layer<ConfigDiscovery, never, FileSystem.FileSystem> = Layer.effect(
	ConfigDiscovery,
	Effect.gen(function* () {
		const fs = yield* FileSystem.FileSystem;

		const findAll = (name: string, options?: { cwd?: string }): Effect.Effect<ReadonlyArray<ConfigLocation>> =>
			Effect.gen(function* () {
				const cwd = options?.cwd ?? process.cwd();
				const results: ConfigLocation[] = [];

				// Priority 1: lib/configs/{name}
				const libPath = `${cwd}/lib/configs/${name}`;
				const libExists = yield* safeExists(fs, libPath);
				if (libExists) {
					results.push({ path: libPath, source: "lib" });
				}

				// Priority 2: {cwd}/{name}
				const rootPath = `${cwd}/${name}`;
				const rootExists = yield* safeExists(fs, rootPath);
				if (rootExists) {
					results.push({ path: rootPath, source: "root" });
				}

				return results;
			});

		const find = (name: string, options?: { cwd?: string }): Effect.Effect<ConfigLocation | null> =>
			findAll(name, options).pipe(Effect.map((results) => results[0] ?? null));

		return { find, findAll };
	}),
);
