/**
 * How a failure that reaches `CliRuntime.main` reads on stderr.
 *
 * @packageDocumentation
 */

import type { FailureDetails } from "@effected/cli";
import { Cause } from "effect";

/** Where a defect report asks to be filed; mirrors `package.json#bugs.url`. */
const ISSUES_URL = "https://github.com/savvy-web/systems/issues";

const HIDDEN = new Set(["_tag", "message", "name", "stack", "cause"]);

/** A field value as text; never throws, since a bigint or circular field would make `JSON.stringify` hide the failure. */
const field = (value: unknown): string => {
	if (typeof value === "string") return value;
	try {
		return JSON.stringify(value) ?? String(value);
	} catch {
		return String(value);
	}
};

/** One line for a typed failure: its own message, else its tag with its fields, else `String`. */
const describe = (error: unknown): string => {
	if (error instanceof Error && error.message !== "") return error.message;
	if (typeof error === "object" && error !== null && "_tag" in error) {
		const fields = Object.entries(error)
			.filter(([key]) => !HIDDEN.has(key))
			.map(([key, value]) => `${key}: ${field(value)}`);
		const tag = String(error._tag);
		return fields.length > 0 ? `${tag}: ${fields.join(", ")}` : tag;
	}
	return String(error);
};

/**
 * Renders a failure for `CliRuntime.main`'s `render` option.
 *
 * @remarks
 * The kit tells the renderer whether the squashed error is a typed failure
 * or a defect, so nothing here guesses that from the error's shape.
 *
 * - A typed failure is an expected outcome and reads as one line. The kit's
 *   default report (`details.defaultLines`) is a status line plus a cleaned
 *   stack, which is noise for an expected outcome, and a `Data.TaggedError`
 *   with no `message` loses the fields that say what went wrong (`CleanError`,
 *   with the `reason` lost), so this prefers the error's own message, then
 *   its tag with its fields, then `String`.
 * - A defect — a `die`, a thrown exception — is a bug in savvy. It gets the
 *   issue-report treatment: a headline, the whole pretty-printed cause with
 *   its stack, and where to report it.
 *
 * @internal
 */
export class FailureLine {
	private constructor() {}

	static readonly render = (error: unknown, details: FailureDetails): string | ReadonlyArray<string> =>
		details.isDefect
			? [
					`savvy hit an unexpected error: ${describe(error)}`,
					...Cause.pretty(details.cause).split("\n"),
					`This is a bug in savvy. Please report it with the output above at ${ISSUES_URL}`,
				]
			: describe(error);
}
