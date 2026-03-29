import { Schema } from "effect";

/**
 * Result of a Biome schema URL sync or check operation.
 *
 * @remarks
 * - `updated` — paths of config files whose `$schema` URL was changed (or would be changed on `check`).
 * - `skipped` — paths of config files with no `$schema` field or a non-biomejs.dev URL.
 * - `current` — paths of config files already pointing to the expected schema URL.
 *
 * @since 0.1.0
 */
export const BiomeSyncResult = Schema.Struct({
	updated: Schema.Array(Schema.String),
	skipped: Schema.Array(Schema.String),
	current: Schema.Array(Schema.String),
});
/** @since 0.1.0 */
export type BiomeSyncResult = typeof BiomeSyncResult.Type;

/**
 * Options for {@link BiomeSchemaSync} operations.
 *
 * @remarks
 * `cwd` overrides the working directory used to locate `biome.json` / `biome.jsonc`.
 * `gitignore` is reserved for future use to skip gitignored config files (defaults to `true`).
 *
 * @since 0.1.0
 */
export const BiomeSyncOptions = Schema.Struct({
	cwd: Schema.optional(Schema.String),
	gitignore: Schema.optionalWith(Schema.Boolean, { default: () => true }),
});
/** @since 0.1.0 */
export type BiomeSyncOptions = typeof BiomeSyncOptions.Type;
