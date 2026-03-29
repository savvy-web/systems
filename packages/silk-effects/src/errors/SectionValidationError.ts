import { Data } from "effect";

/**
 * Raised when a {@link SectionBlock} fails validation at creation time.
 *
 * @since 0.2.0
 */
export class SectionValidationError extends Data.TaggedError("SectionValidationError")<{
	readonly toolName: string;
	readonly reason: string;
}> {
	get message() {
		return `Section validation failed for ${this.toolName}: ${this.reason}`;
	}
}
