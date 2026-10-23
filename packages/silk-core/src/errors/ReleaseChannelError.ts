import { Data } from "effect";

/**
 * Raised when a publish target declares a `releases` value that is not a known release channel.
 *
 * @remarks
 * A target's `releases` is one of `"all"`, `"stable"` or `"prerelease"`; an absent value means
 * `"all"`. The bundler rejects anything else at build time, but a release reads the value again
 * from `dist/prod/targets.json` or, before the build, from `publishConfig.targets`, and either can
 * be hand-edited. An unknown value is refused rather than defaulted, because guessing which
 * versions a registry should receive is how a prerelease ends up on `latest`.
 *
 * @since 0.5.0
 * @public
 */
export class ReleaseChannelError extends Data.TaggedError("ReleaseChannelError")<{
	/** The package whose targets were being resolved. */
	readonly pkg: string;
	/** The `publishConfig.targets` key that declared the value. */
	readonly id: string;
	/** The declared value, as JSON. */
	readonly value: string;
}> {
	get message() {
		return (
			`Package ${this.pkg} target "${this.id}" declares releases ${this.value}, ` +
			`which is not one of "all", "stable" or "prerelease".`
		);
	}
}
