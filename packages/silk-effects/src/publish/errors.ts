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

/**
 * Raised when the `publishConfig` field in a `package.json` is present but invalid.
 *
 * @remarks
 * Returned by {@link SilkPublishabilityPlugin.detect} when `publishConfig` exists
 * but cannot be mapped to a valid set of publish targets.
 *
 * @since 0.1.0
 */
export class PublishConfigError extends Data.TaggedError("PublishConfigError")<{
	readonly packageName: string;
	readonly reason: string;
}> {
	get message() {
		return `Invalid publishConfig for ${this.packageName}: ${this.reason}`;
	}
}
