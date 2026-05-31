/**
 * `analyze-branch` command -- diff the current branch and classify every
 * changed file.
 *
 * @remarks
 * Wraps {@link BranchAnalyzer.analyzeBranch}. Returns the merge-base SHA,
 * the per-file classification, the deduped package list affected by the
 * branch, and the list of paths that didn't map to any release surface
 * (candidates for an AskUserQuestion in agent workflows).
 *
 * @example
 * ```bash
 * savvy changeset analyze-branch
 * savvy changeset analyze-branch --base main --json
 * savvy changeset analyze-branch --cwd ./project --base develop
 * ```
 *
 * @internal
 */

import { resolve } from "node:path";
import { Command, Options } from "@effect/cli";
import { Changesets } from "@savvy-web/silk-effects";
import { Effect, Option } from "effect";

type BranchAnalysis = Changesets.BranchAnalysis;
const { BranchAnalyzer } = Changesets;

/* v8 ignore start -- CLI option definitions */
const cwdOption = Options.directory("cwd").pipe(
	Options.withDescription("Project root (defaults to the current working directory)"),
	Options.withDefault("."),
);
const baseOption = Options.text("base").pipe(
	Options.withDescription("Override the base branch (defaults to config baseBranch or origin/HEAD)"),
	Options.optional,
);
const jsonOption = Options.boolean("json").pipe(
	Options.withDescription("Emit JSON instead of human-readable output"),
	Options.withDefault(false),
);
/* v8 ignore stop */

/**
 * Render a {@link BranchAnalysis} as human-readable text.
 *
 * @internal
 */
export function renderHuman(analysis: BranchAnalysis): string {
	const lines: string[] = [];
	lines.push(`Base branch:    ${analysis.baseBranch}`);
	lines.push(`Merge base SHA: ${analysis.mergeBaseSha}`);
	lines.push("");

	if (analysis.packagesAffected.length > 0) {
		lines.push(`Packages affected (${analysis.packagesAffected.length}):`);
		for (const p of analysis.packagesAffected) lines.push(`  ${p}`);
	} else {
		lines.push("Packages affected: (none)");
	}
	lines.push("");

	if (analysis.files.length === 0) {
		lines.push("Changes: (no files changed)");
	} else {
		lines.push(`Changes (${analysis.files.length}):`);
		const statusGlyph: Record<string, string> = {
			added: "A",
			modified: "M",
			deleted: "D",
			renamed: "R",
			copied: "C",
			typechange: "T",
			unmerged: "U",
			unknown: "?",
		};
		for (const f of analysis.files) {
			const glyph = statusGlyph[f.status] ?? "?";
			const owner = f.package ?? "<unmapped>";
			const reason =
				f.reason === "workspace" ? "workspace" : f.reason !== null ? `${f.reason.kind}: ${f.reason.glob}` : "—";
			lines.push(`  ${glyph}  ${f.path}\t${owner}\t${reason}`);
		}
	}

	if (analysis.unmappedFiles.length > 0) {
		lines.push("");
		lines.push(`Unmapped (${analysis.unmappedFiles.length}):`);
		for (const p of analysis.unmappedFiles) lines.push(`  ${p}`);
	}
	return lines.join("\n");
}

/**
 * Resolve cwd + base branch, invoke `BranchAnalyzer.analyzeBranch`, and
 * render the result. Sets `process.exitCode = 1` on `ConfigurationError`
 * or `GitError`.
 *
 * @internal
 */
export function runAnalyzeBranch(cwd: string, base: Option.Option<string>, json: boolean) {
	return Effect.gen(function* () {
		const analyzer = yield* BranchAnalyzer;
		const resolvedCwd = resolve(cwd);
		const baseBranch = Option.getOrUndefined(base);
		const analysis = yield* analyzer.analyzeBranch(resolvedCwd, baseBranch ? { baseBranch } : undefined).pipe(
			Effect.catchTags({
				ConfigurationError: (err) => {
					process.exitCode = 1;
					return Effect.fail(err);
				},
				GitError: (err) => {
					process.exitCode = 1;
					return Effect.fail(err);
				},
			}),
		);

		const output = json ? JSON.stringify(analysis, null, 2) : renderHuman(analysis);
		yield* Effect.log(output);
	});
}

/* v8 ignore next 6 -- CLI registration */
export const analyzeBranchCommand = Command.make(
	"analyze-branch",
	{ cwd: cwdOption, base: baseOption, json: jsonOption },
	({ cwd, base, json }) => runAnalyzeBranch(cwd, base, json),
).pipe(Command.withDescription("Diff the current branch and classify every changed file by owning package"));
