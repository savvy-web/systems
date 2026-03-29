import { Data } from "effect";

/**
 * Raised when a config file cannot be located in any of the expected locations.
 *
 * @remarks
 * Returned by consumers that require a config file to exist. {@link ConfigDiscovery.find}
 * itself returns `null` instead of failing — callers that need a hard failure should
 * map `null` to this error.
 *
 * @since 0.1.0
 */
export class ConfigNotFoundError extends Data.TaggedError("ConfigNotFoundError")<{
	readonly name: string;
	readonly searchedPaths: ReadonlyArray<string>;
}> {
	get message() {
		return `Config '${this.name}' not found. Searched: ${this.searchedPaths.join(", ")}`;
	}
}
