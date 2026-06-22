import { Data } from "effect";

/**
 * Raised when a Biome config file cannot be read or its `$schema` URL cannot be updated.
 *
 * @remarks
 * Returned by `BiomeSchemaSync.sync` and `BiomeSchemaSync.check` when
 * a `biome.json` or `biome.jsonc` file exists but cannot be read, contains invalid JSON,
 * or cannot be written back to disk.
 *
 * @since 0.1.0
 * @public
 */
export class BiomeSyncError extends Data.TaggedError("BiomeSyncError")<{
	readonly path: string;
	readonly reason: string;
}> {
	get message() {
		return `Failed to sync biome schema in ${this.path}: ${this.reason}`;
	}
}
