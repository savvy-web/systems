import { Data } from "effect";

/**
 * Raised when a git tag string cannot be formatted for the given package name and version.
 *
 * @remarks
 * Returned by {@link TagStrategy.formatTag} when the `version` argument is an empty string
 * or another invariant prevents tag construction.
 *
 * @since 0.1.0
 */
export class TagFormatError extends Data.TaggedError("TagFormatError")<{
	readonly name: string;
	readonly version: string;
	readonly reason: string;
}> {
	get message() {
		return `Failed to format tag for ${this.name}@${this.version}: ${this.reason}`;
	}
}
