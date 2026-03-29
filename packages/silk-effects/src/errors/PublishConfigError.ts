import { Data } from "effect";

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
