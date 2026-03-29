import { Data } from "effect";

/**
 * Raised when the versioning strategy cannot be determined from the workspace state.
 *
 * @remarks
 * Returned by {@link VersioningStrategy.detect} when an unexpected condition
 * prevents strategy classification.
 *
 * @since 0.1.0
 */
export class VersioningDetectionError extends Data.TaggedError("VersioningDetectionError")<{
	readonly reason: string;
}> {
	get message() {
		return `Failed to detect versioning strategy: ${this.reason}`;
	}
}
