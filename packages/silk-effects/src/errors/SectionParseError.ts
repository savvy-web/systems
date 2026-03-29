import { Data } from "effect";

/**
 * Raised when a managed section cannot be parsed from a file.
 *
 * @since 0.2.0
 */
export class SectionParseError extends Data.TaggedError("SectionParseError")<{
	readonly path: string;
	readonly reason: string;
}> {
	get message() {
		return `Failed to parse section in ${this.path}: ${this.reason}`;
	}
}
