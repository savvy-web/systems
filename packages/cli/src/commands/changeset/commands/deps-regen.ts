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
 * @example
 * ```bash
 * savvy changeset deps regen
 * savvy changeset deps regen --dry-run --json
 * savvy changeset deps regen --package @scope/foo
 * ```
 *
 * @internal
 */

import { Command, Options } from "@effect/cli";
import { Changesets } from "@savvy-web/silk-effects";
import { Console, Effect, Option } from "effect";

type RegenPlan = Changesets.RegenPlan;
const { DepsRegen } = Changesets;

/* v8 ignore start -- CLI option definitions */
const cwdOption = Options.directory("cwd").pipe(
	Options.withDescription("Project root (defaults to the current working directory)"),
	Options.withDefault("."),
);
const baseOption = Options.text("base").pipe(
	Options.withDescription("Override the base branch (defaults to config baseBranch)"),
	Options.optional,
);
const packageOption = Options.text("package").pipe(
	Options.withDescription("Restrict regeneration to a single workspace package"),
	Options.optional,
);
const dryRunOption = Options.boolean("dry-run").pipe(
	Options.withDescription("Print the plan without writing or deleting"),
	Options.withDefault(false),
);
const jsonOption = Options.boolean("json").pipe(
	Options.withDescription("Emit a structured plan as JSON"),
	Options.withDefault(false),
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
				Effect.catchTags({
					GitError: (err) => {
						process.exitCode = 1;
						return Effect.fail(err);
					},
					GitReadError: (err) => {
						process.exitCode = 1;
						return Effect.fail(err);
					},
				}),
			);

		if (!dryRun) {
			yield* service.execute(plan);
		}

		if (json) {
			yield* Console.log(JSON.stringify(plan, null, 2));
		} else {
			yield* renderHumanPlan(plan);
		}
	});
}

function renderHumanPlan(plan: RegenPlan) {
	return Effect.gen(function* () {
		if (plan.toDelete.length === 0 && plan.toWrite.length === 0) {
			yield* Effect.log("No dependency changes to regenerate.");
		} else {
			if (plan.toDelete.length > 0) {
				yield* Effect.log(`Deleted ${plan.toDelete.length} pure dependency changeset(s):`);
				for (const entry of plan.toDelete) {
					yield* Effect.log(`  - ${entry.file}  (${entry.package})`);
				}
			}
			if (plan.toWrite.length > 0) {
				yield* Effect.log(`Wrote ${plan.toWrite.length} fresh dependency changeset(s):`);
				for (const entry of plan.toWrite) {
					yield* Effect.log(
						`  + ${entry.file}  (${entry.package} — ${entry.diff.rows.length} row${entry.diff.rows.length === 1 ? "" : "s"})`,
					);
				}
			}
		}
		if (plan.skippedMixed.length > 0) {
			yield* Effect.log(
				`\nSkipped ${plan.skippedMixed.length} mixed changeset(s) (have Dependencies but also other content):`,
			);
			for (const file of plan.skippedMixed) {
				yield* Effect.log(`  ~ ${file}`);
			}
		}
	});
}

/* v8 ignore next 8 */
export const depsRegenCommand = Command.make(
	"regen",
	{ cwd: cwdOption, base: baseOption, package: packageOption, dryRun: dryRunOption, json: jsonOption },
	({ cwd, base, package: pkg, dryRun, json }) => runDepsRegen(cwd, base, pkg, dryRun, json),
).pipe(Command.withDescription("Delete pure dependency changesets and regenerate them from the current diff"));
