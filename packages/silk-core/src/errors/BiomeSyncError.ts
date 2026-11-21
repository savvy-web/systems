import { Data, Schema } from "effect";

/**
 * The stage at which syncing a Biome config file failed.
 *
 * @remarks
 * - `read-failed` — the file exists but could not be read.
 * - `parse-failed` — the file's contents are not valid JSONC.
 * - `edit-failed` — the `$schema` edit could not be computed.
 * - `write-failed` — the updated contents could not be written back.
 *
 * @since 0.7.0
 * @public
 */
export const BiomeSyncErrorCode = Schema.Literals(["read-failed", "parse-failed", "edit-failed", "write-failed"]);

/**
 * The stage at which syncing a Biome config file failed.
 *
 * @since 0.7.0
 * @public
 */
export type BiomeSyncErrorCode = typeof BiomeSyncErrorCode.Type;

const PHRASES: Record<BiomeSyncErrorCode, string> = {
	"read-failed": "could not read",
	"parse-failed": "is not valid JSONC",
	"edit-failed": "could not update $schema",
	"write-failed": "could not write",
};

/**
 * Raised when a Biome config file cannot be read or its `$schema` URL cannot be updated.
 *
 * @remarks
 * Returned by `BiomeSchemaSync.sync` and `BiomeSchemaSync.check` when
 * a `biome.json` or `biome.jsonc` file exists but cannot be read, contains invalid JSONC,
 * or cannot be written back to disk. Match on `code` to tell the failure stages apart;
 * the `message` is derived from `path` and `code` and is for display only. The
 * underlying failure rides unchanged in `cause`.
 *
 * @since 0.1.0
 * @public
 */
export class BiomeSyncError extends Data.TaggedError("BiomeSyncError")<{
	/** The Biome config file that failed to sync. */
	readonly path: string;
	/** The stage at which the sync failed. */
	readonly code: BiomeSyncErrorCode;
	/** The original failure (a `PlatformError`, a JSONC parse or edit error). */
	readonly cause: unknown;
}> {
	get message() {
		return `Failed to sync biome schema in ${this.path}: ${PHRASES[this.code]}`;
	}
}
