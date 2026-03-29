import { Data } from "effect";

/**
 * Raised when a managed section cannot be written to a file.
 *
 * @since 0.2.0
 */
export class SectionWriteError extends Data.TaggedError("SectionWriteError")<{
	readonly path: string;
	readonly reason: string;
}> {
	get message() {
		return `Failed to write section to ${this.path}: ${this.reason}`;
	}
}
