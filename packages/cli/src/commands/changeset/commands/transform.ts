/**
 * Transform command -- post-process CHANGELOG.md.
 *
 * Runs all remark transform plugins (section reordering, deduplication,
 * contributor footnotes, issue link references, and format normalization)
 * against a changelog file.
 *
 * @remarks
 * The command supports three modes:
 * - **Default** -- read the file, transform, and write back in place.
 * - **`--dry-run` / `-n`** -- print the transformed output to stdout
 *   without writing.
 * - **`--check` / `-c`** -- compare the transformed output against the
 *   original and exit with code 1 if they differ (useful in CI).
 *
 * Before any of those modes run, the command requires a valid
 * `.changeset/config.json` (when one exists). A broken config indicates
 * something structurally wrong with the project — refusing here surfaces
 * that to the user rather than producing output the version step couldn't
 * later corroborate.
 *
 * @example
 * ```bash
 * savvy changeset transform CHANGELOG.md
 * savvy changeset transform --dry-run CHANGELOG.md
 * savvy changeset transform --check CHANGELOG.md
 * ```
 *
 * @internal
 */

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { Changesets } from "@savvy-web/silk-effects";
import { Effect } from "effect";
import { Argument, Command, Flag } from "effect/unstable/cli";

import { requireValidConfig } from "../utils/config-gate.js";

const { ChangelogTransformer } = Changesets;

/* v8 ignore start -- CLI option definitions; handler tested via runTransform */
const fileArg = Argument.file("file").pipe(Argument.withDefault("CHANGELOG.md"));

const dryRunOption = Flag.boolean("dry-run").pipe(
	Flag.withAlias("n"),
	Flag.withDescription("Print transformed output instead of writing"),
	Flag.withDefault(false),
);

const checkOption = Flag.boolean("check").pipe(
	Flag.withAlias("c"),
	Flag.withDescription("Exit 1 if file would change (for CI)"),
	Flag.withDefault(false),
);
/* v8 ignore stop */

/**
 * Run the remark transform pipeline on a single changelog file.
 *
 * Reads the file at `file`, applies all remark transform plugins via
 * {@link ChangelogTransformer.transformContent}, and either writes the result
 * back, prints it to stdout (`dryRun`), or checks for differences (`check`).
 *
 * @param file - Path to the CHANGELOG.md file (resolved relative to cwd)
 * @param dryRun - When `true`, print transformed output instead of writing
 * @param check - When `true`, exit with code 1 if the file would change
 * @returns An Effect that performs the transformation
 *
 * @internal
 */
export function runTransform(file: string, dryRun: boolean, check: boolean) {
	return Effect.gen(function* () {
		const resolved = resolve(file);
		// Anchor the config gate on the CHANGELOG file's directory. For the
		// canonical `CHANGELOG.md` at the project root that's the project
		// root; for nested workspace CHANGELOGs the gate walks up via
		// `requireValidConfig`'s `.changeset/config.json` existence check.
		yield* requireValidConfig(dirname(resolved));
		const content = yield* Effect.try(() => readFileSync(resolved, "utf-8"));
		const result = ChangelogTransformer.transformContent(content);

		if (dryRun) {
			yield* Effect.log(result);
			return;
		}

		if (check) {
			if (result !== content) {
				yield* Effect.log(`${resolved} would be modified by transform.`);
				process.exitCode = 1;
			} else {
				yield* Effect.log(`${resolved} is already formatted.`);
			}
			return;
		}

		yield* Effect.try(() => writeFileSync(resolved, result, "utf-8"));
		yield* Effect.log(`Transformed ${resolved}`);
	});
}

/* v8 ignore next 5 -- CLI registration; handler tested via runTransform */
export const transformCommand = Command.make(
	"transform",
	{ file: fileArg, dryRun: dryRunOption, check: checkOption },
	({ file, dryRun, check }) => runTransform(file, dryRun, check),
).pipe(Command.withDescription("Post-process CHANGELOG.md"));
