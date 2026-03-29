import { Data } from "effect";

/**
 * Raised when a publish target value cannot be resolved into a {@link ResolvedTarget}.
 *
 * @remarks
 * Returned by {@link TargetResolver.resolve} when the input is not a recognised shorthand,
 * a valid `https://` URL, or a well-formed object target.
 *
 * @since 0.1.0
 */
export class TargetResolutionError extends Data.TaggedError("TargetResolutionError")<{
	readonly target: unknown;
	readonly reason: string;
}> {
	get message() {
		return `Failed to resolve publish target: ${this.reason}`;
	}
}
