import { Data } from "effect";

/**
 * Error when a GitHub Action output fails schema validation or writing.
 * @public
 */
export class ActionOutputError extends Data.TaggedError("ActionOutputError")<{
	/** The output name. */
	readonly outputName: string;

	/** Human-readable description of what went wrong. */
	readonly reason: string;
}> {}
