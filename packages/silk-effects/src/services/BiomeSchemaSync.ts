import { Jsonc, JsoncEdit, JsoncModifier } from "@effected/jsonc";
import { Context, Effect, FileSystem, Layer } from "effect";
import { BiomeSyncError } from "../errors/BiomeSyncError.js";
import type { BiomeSyncResult } from "../schemas/BiomeConfig.js";

/**
 * Strip leading semver range operators from a version string.
 *
 * @param version - Raw version string that may include `^`, `~`, `>=`, `<`, `=`, or `v` prefixes.
 * @returns The bare semver string (e.g. `"1.9.3"`).
 *
 * @since 0.1.0
 * @public
 */
export function extractSemver(version: string): string {
	return version.replace(/^[\^~>=<v]+/, "");
}

/**
 * Build the expected Biome JSON schema URL for a given version.
 *
 * @param version - Bare semver string (e.g. `"1.9.3"`).
 * @returns The canonical `biomejs.dev` schema URL for that version.
 *
 * @since 0.1.0
 * @public
 */
export function buildSchemaUrl(version: string): string {
	return `https://biomejs.dev/schemas/${version}/schema.json`;
}

const BIOME_SCHEMA_HOSTNAME = "biomejs.dev";

function normalizeHostname(hostname: string): string {
	return hostname.toLowerCase().replace(/\.+$/, "");
}

function isBiomeSchemaUrl(schema: string): boolean {
	try {
		return normalizeHostname(new URL(schema).hostname) === BIOME_SCHEMA_HOSTNAME;
	} catch {
		return false;
	}
}

/** Check which biome config files exist in cwd. */
function findBiomeConfigs(cwd: string, fs: FileSystem.FileSystem): Effect.Effect<string[]> {
	const candidates = [`${cwd}/biome.json`, `${cwd}/biome.jsonc`];
	return Effect.gen(function* () {
		const results: string[] = [];
		for (const candidate of candidates) {
			const exists = yield* fs.exists(candidate).pipe(Effect.orElseSucceed(() => false));
			if (exists) {
				results.push(candidate);
			}
		}
		return results;
	});
}

/**
 * The {@link BiomeSchemaSync} service shape.
 *
 * @since 3.2.0
 * @public
 */
export interface BiomeSchemaSyncShape {
	/**
	 * Update the `$schema` URL in all located Biome config files to match `version`.
	 *
	 * @param version - Target Biome version (range operators are stripped automatically).
	 * @param options - Optional `cwd` and `gitignore` overrides.
	 * @returns An `Effect` that succeeds with a {@link (BiomeSyncResult:type)} or fails with {@link BiomeSyncError}.
	 *
	 * @since 0.1.0
	 */
	readonly sync: (
		version: string,
		options?: { cwd?: string; gitignore?: boolean },
	) => Effect.Effect<BiomeSyncResult, BiomeSyncError>;

	/**
	 * Check whether the `$schema` URL in Biome config files is current, without writing any changes.
	 *
	 * @param version - Target Biome version (range operators are stripped automatically).
	 * @param options - Optional `cwd` and `gitignore` overrides.
	 * @returns An `Effect` that succeeds with a {@link (BiomeSyncResult:type)} or fails with {@link BiomeSyncError}.
	 *   Files that would be updated appear in `updated`; no disk writes occur.
	 *
	 * @since 0.1.0
	 */
	readonly check: (
		version: string,
		options?: { cwd?: string; gitignore?: boolean },
	) => Effect.Effect<BiomeSyncResult, BiomeSyncError>;
}

/**
 * Service that keeps the `$schema` URL in Biome config files in sync with a target version.
 *
 * @remarks
 * Locates `biome.json` and `biome.jsonc` files in the working directory, then compares
 * each file's `$schema` field against the expected `biomejs.dev` URL for the given version.
 * `sync` writes updates in-place; `check` returns the same result without modifying files.
 *
 * @example
 * ```typescript
 * const result = await Effect.runPromise(
 *   Effect.gen(function* () {
 *     const syncer = yield* BiomeSchemaSync;
 *     return yield* syncer.sync("^1.9.3");
 *   }).pipe(
 *     Effect.provide(BiomeSchemaSync.layer),
 *     Effect.provide(NodeServices.layer),
 *   )
 * );
 * ```
 *
 * @since 0.1.0
 * @public
 */
export class BiomeSchemaSync extends Context.Service<BiomeSchemaSync, BiomeSchemaSyncShape>()(
	"@savvy-web/silk-effects/BiomeSchemaSync",
) {
	/**
	 * Production implementation of {@link BiomeSchemaSync}.
	 *
	 * @remarks
	 * Requires the core `FileSystem` service. Provide `NodeServices.layer` (or
	 * `NodeFileSystem.layer`) from `@effect/platform-node` to satisfy this dependency.
	 *
	 * @since 0.1.0
	 * @public
	 */
	static readonly layer: Layer.Layer<BiomeSchemaSync, never, FileSystem.FileSystem> = Layer.effect(
		this,
		Effect.gen(function* () {
			const fs = yield* FileSystem.FileSystem;

			const run = (
				version: string,
				options: { cwd?: string; gitignore?: boolean } | undefined,
				write: boolean,
			): Effect.Effect<BiomeSyncResult, BiomeSyncError> =>
				Effect.gen(function* () {
					const cwd = options?.cwd ?? process.cwd();
					const semver = extractSemver(version);
					const expectedUrl = buildSchemaUrl(semver);

					const configs = yield* findBiomeConfigs(cwd, fs);

					const updated: string[] = [];
					const skipped: string[] = [];
					const current: string[] = [];

					for (const configPath of configs) {
						const raw = yield* fs.readFileString(configPath).pipe(
							Effect.mapError(
								/* v8 ignore next 4 -- error path requires a filesystem read failure */
								(cause) =>
									new BiomeSyncError({
										path: configPath,
										reason: String(cause),
									}),
							),
						);

						const parsed = (yield* Jsonc.parse(raw).pipe(
							Effect.mapError(
								/* v8 ignore next 4 -- error path requires a JSONC parse failure */
								(e) =>
									new BiomeSyncError({
										path: configPath,
										reason: `Failed to parse JSONC: ${String(e)}`,
									}),
							),
						)) as Record<string, unknown>;

						const schema = parsed.$schema;

						if (typeof schema !== "string") {
							// No $schema field
							skipped.push(configPath);
							continue;
						}

						if (!isBiomeSchemaUrl(schema)) {
							// Not a biomejs.dev URL
							skipped.push(configPath);
							continue;
						}

						if (schema === expectedUrl) {
							current.push(configPath);
							continue;
						}

						// Wrong version — update
						if (write) {
							const updatedContent = yield* JsoncModifier.modify(raw, ["$schema"], expectedUrl).pipe(
								Effect.map((edits) => JsoncEdit.applyAll(raw, edits)),
								Effect.mapError(
									/* v8 ignore next 4 -- error path requires a JSONC edit failure */
									(error) =>
										new BiomeSyncError({
											path: configPath,
											reason: `Failed to update JSONC: ${String(error)}`,
										}),
								),
							);

							yield* fs.writeFileString(configPath, updatedContent).pipe(
								Effect.mapError(
									/* v8 ignore next 4 -- error path requires a filesystem write failure */
									(cause) =>
										new BiomeSyncError({
											path: configPath,
											reason: String(cause),
										}),
								),
							);
						}
						updated.push(configPath);
					}

					return { updated, skipped, current };
				});

			return {
				sync: (version, options) => run(version, options, true),
				check: (version, options) => run(version, options, false),
			};
		}),
	);
}
