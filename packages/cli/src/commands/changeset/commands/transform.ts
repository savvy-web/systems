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
 *   original and exit with code 1 if they differ (useful in CI), showing
 *   the drifted lines as a capped diff (original against transformed).
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
import { CliExit, Doc } from "@effected/cli";
import { Changesets } from "@savvy-web/silk-effects";
import { Effect } from "effect";
import { Argument, Command, Flag } from "effect/cli";
import { Report } from "../../../internal/report.js";
import { requireValidConfig } from "../utils/config-gate.js";

const { ChangelogTransformer } = Changesets;

/** The most diff lines `--check` shows under its finding; the rest is elided. */
const DIFF_CAP = 40;

/**
 * The drifted region of a file: the original lines the transform removes, the
 * lines it adds in their place, and how many lines both sides share before
 * the region.
 */
interface DriftWindow {
	readonly removed: ReadonlyArray<string>;
	readonly added: ReadonlyArray<string>;
	readonly head: number;
}

/** A text's lines; a final line break ends the last line rather than starting an empty one. */
const lines = (text: string): string[] => {
	const all = text.split("\n");
	if (all.at(-1) === "") all.pop();
	return all;
};

/**
 * Narrow `original` and `transformed` to the lines between their common
 * leading and trailing lines, or `undefined` when the two differ only in the
 * file's final line break. Exported for tests only.
 *
 * @internal
 */
export const driftWindow = (original: string, transformed: string): DriftWindow | undefined => {
	const a = lines(original);
	const b = lines(transformed);
	let head = 0;
	while (head < a.length && head < b.length && a[head] === b[head]) head++;
	let tail = 0;
	while (tail < a.length - head && tail < b.length - head && a[a.length - 1 - tail] === b[b.length - 1 - tail]) tail++;
	if (head + tail >= a.length && head + tail >= b.length) return undefined;
	return { removed: a.slice(head, a.length - tail), added: b.slice(head, b.length - tail), head };
};

/** `1 line`, `3 blank lines`: a count of `lines`, called blank when every one is. */
const lineCount = (lines: ReadonlyArray<string>): string => {
	const blank = lines.every((line) => line.trim() === "") ? "blank " : "";
	return `${lines.length} ${blank}${lines.length === 1 ? "line" : "lines"}`;
};

/** `lines` drawn as one side of a diff (`+ text`, or a bare `+` for a blank line), unless every one is blank. */
const listed = (sign: "+" | "-", lines: ReadonlyArray<string>) =>
	lines.every((line) => line.trim() === "")
		? []
		: [Doc.verbatim(lines.map((line) => (line === "" ? sign : `${sign} ${line}`)).join("\n"), { indent: 2 })];

/**
 * What `--check` shows under its finding for one drifted region.
 *
 * @remarks
 * `Doc.diff` is not a line diff: it draws every expected line as removed and
 * every received line as added, and an empty side joins to the same `""` as a
 * single blank line. So the window holds only lines that changed (an unchanged
 * context line would read as removed and re-added), and a region that only
 * inserts or only removes lines is described in words, with its non-blank
 * lines listed, rather than drawn as a diff against nothing. A replacement is
 * a `Doc.diff`, capped so a long CHANGELOG never floods the report.
 * Exported for tests only.
 *
 * @internal
 */
export const driftReport = (file: string, drift: DriftWindow | undefined) => {
	const finding = `${file} would be modified by transform`;
	if (drift === undefined) return [Report.warn(finding, "only its final line break differs")];
	const { removed, added, head } = drift;
	if (removed.length === 0) {
		const where = head === 0 ? "at the top" : `after line ${head}`;
		return [Report.warn(finding, `inserts ${lineCount(added)} ${where}`), ...listed("+", added)];
	}
	const span = removed.length === 1 ? `line ${head + 1}` : `lines ${head + 1}-${head + removed.length}`;
	if (added.length === 0) {
		return [Report.warn(finding, `removes ${lineCount(removed)} at ${span}`), ...listed("-", removed)];
	}
	return [Report.warn(finding, `${span}:`), Doc.diff(removed.join("\n"), added.join("\n"), { cap: DIFF_CAP })];
};

/* v8 ignore start -- CLI option definitions; handler tested via runTransform */
const fileArg = Argument.File("file").pipe(Argument.withDefault("CHANGELOG.md"));

const dryRunOption = Flag.Boolean("dry-run").pipe(
	Flag.withAlias("n"),
	Flag.withDescription("Print transformed output instead of writing"),
	Flag.withDefault(false),
);

const checkOption = Flag.Boolean("check").pipe(
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
			yield* Report.print([Report.verbatim(result)]);
			return;
		}

		if (check) {
			if (result !== content) {
				yield* Report.print(driftReport(resolved, driftWindow(content, result)));
				yield* CliExit.set(1);
			} else {
				yield* Report.print([Report.ok(`${resolved} is already formatted`)]);
			}
			return;
		}

		yield* Effect.try(() => writeFileSync(resolved, result, "utf-8"));
		yield* Report.print([Report.ok(`Transformed ${resolved}`)]);
	});
}

/* v8 ignore next 5 -- CLI registration; handler tested via runTransform */
export const transformCommand = Command.make(
	"transform",
	{ file: fileArg, dryRun: dryRunOption, check: checkOption },
	({ file, dryRun, check }) => runTransform(file, dryRun, check),
).pipe(Command.withDescription("Post-process CHANGELOG.md"));
