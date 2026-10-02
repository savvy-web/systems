/**
 * `deps regen` command — delete all pure dependency changesets and
 * write fresh single-package, patch-bump changesets reflecting the
 * cumulative dep diff from base to working tree.
 *
 * @remarks
 * This is a thin adapter over {@link Changesets.DepsRegen}: the plan/execute
 * orchestration (pure-dependency-changeset detection, protocol-specifier
 * resolution, filename generation, and the filesystem writes themselves)
 * lives in `@savvy-web/silk-effects`. This command only translates CLI
 * options into a `plan()` call, conditionally applies the plan via
 * `execute()`, and renders the resulting {@link RegenPlan}.
 *
 * **The single-package-per-changeset rule.** The service enforces our
 * convention that each `.changeset/*.md` file lists exactly one package
 * in its frontmatter. `@changesets/cli` technically supports multi-package
 * frontmatter, but our agent (and this command) always produces single-
 * package files for clarity and easier hand-editing.
 *
 * **Strict "pure dependency changeset" detection.** A changeset is
 * eligible for deletion-and-regeneration if and only if:
 *
 * 1. Its frontmatter declares exactly one package, and
 * 2. Its body contains exactly one `##` heading, and
 * 3. That heading is `Dependencies`.
 *
 * Anything else (multi-package frontmatter, additional sections, comments,
 * `### Sub-headings`, etc.) is treated as "mixed" and left untouched.
 * That's the safe default — if a human authored something idiosyncratic,
 * we don't clobber it. `devDependency` rows are dropped by the service
 * (the regen default) and protocol specifiers (`catalog:`/`workspace:`)
 * are resolved to concrete versions.
 *
 * **Dry-run reporting.** With `--dry-run` nothing is written or deleted, so
 * the human output is phrased as a plan (`Would delete N pure dependency
 * changeset(s):` / `Would write N dependency changeset(s):`, each over a
 * file / package (/ rows) table) rather than the
 * real run's `✓ Wrote …` / `✓ Deleted …`. A real run prints each write and
 * delete as `execute()` reports it landing (its `onStep`), so a run that
 * fails partway still shows what already reached disk; it reports what
 * `execute()` did, not what the plan listed: deletes are tolerant, so a
 * planned delete that found nothing or could not remove the file is reported
 * as not removed. `--json`
 * emits the plan's fields plus an explicit `dryRun` boolean in both modes,
 * and a real run adds `execute()`'s `result`.
 *
 * @example
 * ```bash
 * savvy changeset deps regen
 * savvy changeset deps regen --dry-run --json
 * savvy changeset deps regen --package @scope/foo
 * ```
 *
 * @internal
 */

import { resolve } from "node:path";
import type { Block } from "@effected/cli";
import { CliExit, Doc } from "@effected/cli";
import { Changesets } from "@savvy-web/silk-effects";
import { Console, Effect, Option } from "effect";
import { Command, Flag } from "effect/cli";
import { Report } from "../../../internal/report.js";

type RegenPlan = Changesets.RegenPlan;
type RegenResult = Changesets.RegenResult;
type RegenStep = Changesets.RegenStep;
const { DepsRegen } = Changesets;

/* v8 ignore start -- CLI option definitions */
const cwdOption = Flag.Directory("cwd").pipe(
	Flag.withDescription("Project root (defaults to the current working directory)"),
	Flag.withDefault("."),
);
const baseOption = Flag.String("base").pipe(
	Flag.withDescription("Override the base branch (defaults to config baseBranch)"),
	Flag.optional,
);
const packageOption = Flag.String("package").pipe(
	Flag.withDescription("Restrict regeneration to a single workspace package"),
	Flag.optional,
);
const dryRunOption = Flag.Boolean("dry-run").pipe(
	Flag.withDescription("Print the plan without writing or deleting"),
	Flag.withDefault(false),
);
const jsonOption = Flag.Boolean("json").pipe(
	Flag.withDescription("Emit a structured plan as JSON"),
	Flag.withDefault(false),
);
/* v8 ignore stop */

/**
 * Handler exported for direct invocation in tests.
 *
 * @internal
 */
export function runDepsRegen(
	cwd: string,
	base: Option.Option<string>,
	pkg: Option.Option<string>,
	dryRun: boolean,
	json: boolean,
) {
	return Effect.gen(function* () {
		const service = yield* DepsRegen;

		const plan = yield* service
			.plan({
				cwd,
				...(Option.isSome(base) ? { base: base.value } : {}),
				...(Option.isSome(pkg) ? { package: pkg.value } : {}),
			})
			.pipe(
				// Any plan failure (git, IO, discovery, snapshot) exits non-zero; the
				// typed error still propagates for runMain to report.
				Effect.tapError(() => CliExit.set(1)),
			);

		if (json) {
			const result = dryRun ? undefined : yield* service.execute(plan);
			yield* Console.log(JSON.stringify({ ...plan, dryRun, ...(result ? { result } : {}) }, null, 2));
		} else if (dryRun) {
			yield* renderDryRunPlan(plan);
		} else {
			yield* runAndReport(plan, service);
		}
	});
}

interface RegenEntry {
	readonly file: string;
	readonly package: string;
}
type WriteEntry = RegenPlan["toWrite"][number];

/** The columns of a table of changesets to delete (or not removed). */
const DELETE_COLUMNS = [{ header: "file" }, { header: "package" }] as const;
/** The columns of a table of changesets to write. */
const WRITE_COLUMNS = [{ header: "file" }, { header: "package" }, { header: "rows", align: "right" }] as const;

const row = (entry: RegenEntry) => `${entry.file}  (${entry.package})`;
const writeRow = (entry: WriteEntry) =>
	`${entry.file}  (${entry.package} — ${entry.diff.rows.length} row${entry.diff.rows.length === 1 ? "" : "s"})`;

/**
 * Apply the plan for a person, printing each write and delete as `execute`
 * reports it landing, so a failure partway still leaves what reached disk on
 * stdout. The closing summary covers what no step reported: a planned delete
 * absent from `result.deleted` was already gone or could not be removed, and
 * is reported as not removed, never as deleted. Only paths `execute` reports
 * are ever named as written or deleted.
 */
function runAndReport(plan: RegenPlan, service: Changesets.DepsRegenShape) {
	return Effect.gen(function* () {
		const writes = new Map(plan.toWrite.map((entry) => [entry.file, entry]));
		const deletes = new Map(plan.toDelete.map((entry) => [entry.file, entry]));
		const reported = new Set<string>();
		const stepBlock = (step: RegenStep): Block => {
			if (step._tag === "Written") {
				const entry = writes.get(step.file);
				return Report.ok(`Wrote ${entry ? writeRow(entry) : step.file}`);
			}
			const entry = deletes.get(step.file);
			return Report.ok(`Deleted ${entry ? row(entry) : step.file}`);
		};
		const printStep = (step: RegenStep) =>
			Effect.suspend(() => {
				reported.add(`${step._tag}:${step.file}`);
				return Report.print([stepBlock(step)]);
			});

		const result = yield* service.execute(plan, { onStep: printStep });

		// An implementation that reports no steps still gets every landed file
		// named, once, from its result.
		const unreported: Block[] = [
			...result.written
				.filter((file) => !reported.has(`Written:${file}`))
				.map((file) => stepBlock({ _tag: "Written", file })),
			...result.deleted
				.filter((file) => !reported.has(`Deleted:${file}`))
				.map((file) => stepBlock({ _tag: "Deleted", file })),
		];
		yield* renderRunSummary(plan, result, unreported);
	});
}

/** The closing document of a real run: whatever no step printed, then the totals. */
function renderRunSummary(plan: RegenPlan, result: RegenResult, unreported: ReadonlyArray<Block>) {
	const blocks: Block[] = [...unreported];
	if (plan.toDelete.length === 0 && plan.toWrite.length === 0) {
		blocks.push(Report.ok("No dependency changes to regenerate"));
	} else {
		const deleted = new Set(result.deleted);
		const notRemoved = plan.toDelete.filter((entry) => !deleted.has(entry.file));
		if (notRemoved.length > 0) {
			blocks.push(
				Report.skip(`${notRemoved.length} planned deletion(s) not removed (already gone or undeletable):`),
				Doc.table(
					DELETE_COLUMNS,
					notRemoved.map((entry) => [entry.file, entry.package]),
				),
			);
		}
		if (result.written.length > 0 || result.deleted.length > 0) {
			blocks.push(
				Report.ok(
					`Wrote ${result.written.length} fresh and deleted ${result.deleted.length} pure dependency changeset(s)`,
				),
			);
		}
	}
	return Report.print([...blocks, ...mixedBlocks(plan)]);
}

/**
 * Render a dry run for a person. Nothing changed, so its headings are
 * plan-phrased and carry no `✓`.
 */
function renderDryRunPlan(plan: RegenPlan) {
	const blocks: Block[] = [];
	if (plan.toDelete.length === 0 && plan.toWrite.length === 0) {
		blocks.push(Report.ok("No dependency changes to regenerate"));
	} else {
		if (plan.toDelete.length > 0) {
			blocks.push(
				Doc.section(`Would delete ${plan.toDelete.length} pure dependency changeset(s):`, [
					Doc.table(
						DELETE_COLUMNS,
						plan.toDelete.map((entry) => [entry.file, entry.package]),
					),
				]),
			);
		}
		if (plan.toWrite.length > 0) {
			blocks.push(
				Doc.section(`Would write ${plan.toWrite.length} dependency changeset(s):`, [
					Doc.table(
						WRITE_COLUMNS,
						plan.toWrite.map((entry) => [entry.file, entry.package, String(entry.diff.rows.length)]),
					),
				]),
			);
		}
	}
	return Report.print([...blocks, ...mixedBlocks(plan)]);
}

/** The skipped-mixed note both a dry and a real run close with. */
function mixedBlocks(plan: RegenPlan): ReadonlyArray<Block> {
	const blocks: Block[] = [];
	if (plan.skippedMixed.length > 0) {
		blocks.push(
			Report.line(""),
			Report.skip(
				`Skipped ${plan.skippedMixed.length} mixed changeset(s) (have Dependencies but also other content):`,
				...plan.skippedMixed.map((file) => `~ ${file}`),
			),
		);
	}
	return blocks;
}

/* v8 ignore next 12 */
export const depsRegenCommand = Command.make(
	"regen",
	{ cwd: cwdOption, base: baseOption, package: packageOption, dryRun: dryRunOption, json: jsonOption },
	({ cwd, base, package: pkg, dryRun, json }) =>
		// The DepsRegen graph is root-bound at LAYER build, so it is composed here
		// — per invocation, bound to the parsed --cwd — rather than in AppLive
		// (which would silently pin discovery to process.cwd() and half-ignore
		// --cwd). Platform services flow up to AppLive's NodeServices.layer.
		runDepsRegen(cwd, base, pkg, dryRun, json).pipe(
			Effect.provide(Changesets.makeDepsRegenDefault({ cwd: resolve(cwd) })),
		),
).pipe(Command.withDescription("Delete pure dependency changesets and regenerate them from the current diff"));
