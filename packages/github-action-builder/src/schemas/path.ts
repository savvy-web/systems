/**
 * Path schemas for cross-platform compatibility.
 *
 * @remarks
 * Uses Node.js PathLike type to accept strings, Buffers, or URLs.
 *
 * @internal
 */
import type { PathLike as NodePathLike } from "node:fs";
import { fileURLToPath } from "node:url";
import { Schema } from "effect";

/**
 * Re-export Node.js PathLike type for convenience.
 * @internal
 */
export type PathLike = NodePathLike;

/**
 * Convert a PathLike value to a string.
 *
 * @param pathLike - A string, Buffer, or URL path
 * @returns The path as a string
 *
 * @internal
 */
/* v8 ignore start - edge case branches for Buffer/URL paths */
export function pathLikeToString(pathLike: PathLike): string {
	if (typeof pathLike === "string") {
		return pathLike;
	}
	if (Buffer.isBuffer(pathLike)) {
		return pathLike.toString("utf8");
	}
	if (pathLike instanceof URL) {
		return fileURLToPath(pathLike);
	}
	return String(pathLike);
}
/* v8 ignore stop */

/**
 * Schema that accepts PathLike (string, Buffer, or URL) and normalizes to string.
 *
 * @remarks
 * This schema is designed for user-facing inputs where flexibility is important.
 * Internally, paths are stored as strings for serialization compatibility.
 *
 * @internal
 */
export const PathLikeSchema = Schema.transform(
	Schema.Union(Schema.String, Schema.instanceOf(Buffer), Schema.instanceOf(URL)),
	Schema.String,
	{
		strict: true,
		decode: (pathLike) => pathLikeToString(pathLike),
		/* v8 ignore next */
		encode: (s) => s,
	},
);

/**
 * Optional PathLike schema.
 * @internal
 */
export const OptionalPathLikeSchema = Schema.optional(PathLikeSchema);
