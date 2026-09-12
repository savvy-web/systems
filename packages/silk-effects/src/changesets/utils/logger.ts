/**
 * Warning output for changelog generation, parameterised by a
 * {@link ChangesetLogMode} reference instead of an ambient environment read.
 *
 * @remarks
 * This module is engine code shared by every front end, so it must not read
 * `process` — a `process.env` read here would bake one host's environment
 * into every other. The mode is a `Context.Reference` with a default of
 * `"stderr"`; a front end that knows it runs under GitHub Actions or a test
 * runner provides `"github"` or `"silent"` from its own `process.env` read.
 *
 * @packageDocumentation
 */

import { Context, Effect } from "effect";

/**
 * How changelog warnings are emitted.
 *
 * - `"stderr"` — `console.warn(message, ...args)` (the default).
 * - `"github"` — a `::warning::` workflow annotation that surfaces in the
 *   GitHub Actions UI.
 * - `"silent"` — discarded; the mode a test runner provides.
 *
 * @public
 */
export type ChangesetLogModeValue = "silent" | "github" | "stderr";

/**
 * The reference that selects the {@link ChangesetLogModeValue}.
 *
 * @remarks
 * Defaults to `"stderr"` when no front end provides it, so a program that
 * never touches the reference still reports. Provide with
 * `Layer.succeed(ChangesetLogMode, "github")` or
 * `Effect.provideService(ChangesetLogMode, "silent")`.
 *
 * @example
 * ```typescript
 * import { Effect } from "effect";
 * import { Changesets } from "\@savvy-web/silk-effects";
 *
 * const mode = process.env.GITHUB_ACTIONS === "true" ? "github" : "stderr";
 * program.pipe(Effect.provideService(Changesets.ChangesetLogMode, mode));
 * ```
 *
 * @public
 */
export const ChangesetLogMode: Context.Reference<ChangesetLogModeValue> = Context.Reference<ChangesetLogModeValue>(
	"@savvy-web/silk-effects/Changesets/ChangesetLogMode",
	{ defaultValue: () => "stderr" },
);

/**
 * Log a warning message according to the {@link ChangesetLogMode} in context.
 *
 * @param message - The warning message
 * @param args - Additional arguments (concatenated with a space in `"github"` mode)
 * @returns An `Effect` that never fails
 *
 * @internal
 */
export function logWarning(message: string, ...args: unknown[]): Effect.Effect<void> {
	return Effect.gen(function* () {
		const mode = yield* ChangesetLogMode;
		switch (mode) {
			case "silent":
				return;
			case "github": {
				const text = args.length > 0 ? `${message} ${args.join(" ")}` : message;
				console.warn(`::warning::${text}`);
				return;
			}
			case "stderr":
				console.warn(message, ...args);
				return;
		}
	});
}
