import { Data } from "effect";

/**
 * Raised when a managed section cannot be parsed from a file.
 *
 * @remarks
 * Returned by {@link ManagedSection.read} when the file exists but its content
 * cannot be read (e.g. a filesystem permission error).
 *
 * @since 0.1.0
 */
export class ManagedSectionParseError extends Data.TaggedError("ManagedSectionParseError")<{
	readonly path: string;
	readonly reason: string;
}> {
	get message() {
		return `Failed to parse managed section in ${this.path}: ${this.reason}`;
	}
}

/**
 * Raised when a managed section cannot be written to a file.
 *
 * @remarks
 * Returned by {@link ManagedSection.write} and {@link ManagedSection.update} when
 * the file cannot be read for content replacement or when the write itself fails.
 *
 * @since 0.1.0
 */
export class ManagedSectionWriteError extends Data.TaggedError("ManagedSectionWriteError")<{
	readonly path: string;
	readonly reason: string;
}> {
	get message() {
		return `Failed to write managed section to ${this.path}: ${this.reason}`;
	}
}
