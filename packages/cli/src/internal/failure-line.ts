/**
 * How a failure that reaches `CliRuntime.main` reads on stderr.
 *
 * @packageDocumentation
 */

const HIDDEN = new Set(["_tag", "message", "name", "stack", "cause"]);

/**
 * Renders a failure for `CliRuntime.main`'s `render` option.
 *
 * @remarks
 * The kit's default is `String(error)`, which prints a `Data.TaggedError`
 * with no `message` as its bare tag and drops the fields that say what went
 * wrong (`CleanError`, with the `reason` lost). This prefers the error's own
 * message, then its tag with its fields, then `String`.
 *
 * @internal
 */
export class FailureLine {
	private constructor() {}

	static readonly render = (error: unknown): string => {
		if (error instanceof Error && error.message !== "") return error.message;
		if (typeof error === "object" && error !== null && "_tag" in error) {
			const fields = Object.entries(error)
				.filter(([key]) => !HIDDEN.has(key))
				.map(([key, value]) => `${key}: ${typeof value === "string" ? value : JSON.stringify(value)}`);
			const tag = String((error as { readonly _tag: unknown })._tag);
			return fields.length > 0 ? `${tag}: ${fields.join(", ")}` : tag;
		}
		return String(error);
	};
}
