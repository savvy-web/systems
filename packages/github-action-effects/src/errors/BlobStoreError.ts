import { Data } from "effect";

/**
 * Error when a blob store operation (get, put, or has) fails.
 * @public
 */
export class BlobStoreError extends Data.TaggedError("BlobStoreError")<{
	/** The blob key involved. */
	readonly key: string;
	/** The operation that failed. */
	readonly operation: "get" | "put" | "has";
	/** Human-readable description of what went wrong. */
	readonly reason: string;
}> {}
