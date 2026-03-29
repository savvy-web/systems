import { Data } from "effect";

/**
 * Raised when the `.changeset/config.json` file cannot be read or decoded.
 *
 * @remarks
 * Returned by {@link ChangesetConfigReader.read} when the file is missing,
 * contains invalid JSON, or fails Effect Schema validation.
 *
 * @since 0.1.0
 */
export class ChangesetConfigError extends Data.TaggedError("ChangesetConfigError")<{
	readonly path: string;
	readonly reason: string;
}> {
	get message() {
		return `Failed to read changeset config at ${this.path}: ${this.reason}`;
	}
}
