/**
 * How a failure that reaches `CliRuntime.main` reads on stderr.
 *
 * @packageDocumentation
 */

import type { FailureDetails } from "@effected/cli";
import { CliDoc } from "@effected/cli";

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

/** Whether a typed failure draws itself through the kit's `CliDoc` protocol. */
const drawsItself = (error: unknown): boolean =>
	typeof error === "object" && error !== null && CliDoc in error && typeof error[CliDoc] === "function";

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
 * - A typed failure whose error implements the kit's `CliDoc` protocol (the
 *   CLI's own `CommandError`) has already said how it reads, so it gets the
 *   kit's report of that document (`details.defaultLines`), drawn for the
 *   run's audience, instead of one line.
 * - A defect — a `die`, a thrown exception — is a bug in savvy. It gets the
 *   kit's default report (`details.defaultLines`: the status line and the
 *   program's own stack frames, drawn for the run's audience) followed by
 *   where to report it.
 *
 * @internal
 */
export class FailureLine {
	private constructor() {}

	static readonly render = (error: unknown, details: FailureDetails): string | ReadonlyArray<string> => {
		if (details.isDefect) {
			return [
				...details.defaultLines,
				`This is a bug in savvy. Please report it with the output above at ${ISSUES_URL}`,
			];
		}
		return drawsItself(error) ? details.defaultLines : describe(error);
	};

	/**
	 * One line for a typed failure: its own message, else its tag with its
	 * fields, else `String`. What {@link FailureLine.render} prints for a typed
	 * failure that does not draw itself, and what `CommandError.from` keeps of
	 * a foreign error.
	 */
	static readonly describe = (error: unknown): string => describe(error);
}
