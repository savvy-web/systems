/**
 * `deps detect` command — read-only dependency-diff inspection.
 *
 * @remarks
 * A thin adapter over {@link Changesets.DepsRegen}: this command calls
 * `plan({ includeDevDeps: true, ... })` — the read-only path, so devDeps
 * stay in the diff and no file is written or deleted — then renders
 * `plan.toWrite`'s diffs either as structured JSON (one row per change) or
 * as ready-to-paste CSH005 markdown. No file writes.
 *
 * Defaults:
 * - `--from` → `git merge-base <baseBranch> HEAD`
 * - `--to`   → working tree (i.e., `HEAD` plus staged + unstaged + untracked).
 *
 * @example
 * ```bash
 * savvy changeset deps detect
 * savvy changeset deps detect --from HEAD~5 --to HEAD --json
 * savvy changeset deps detect --package @scope/foo --markdown
 * ```
 *
 * @internal
 */

import { Command, Options } from "@effect/cli";
import { Changesets } from "@savvy-web/silk-effects";
import { Console, Effect, Option } from "effect";

type WorkspaceDependencyDiff = Changesets.WorkspaceDependencyDiff;
const { DepsRegen, serializeDependencyTableToMarkdown } = Changesets;

/* v8 ignore start -- CLI option definitions */
const fromOption = Options.text("from").pipe(
	Options.withDescription("Older ref to diff from (defaults to merge-base with base branch)"),
	Options.optional,
);
const toOption = Options.text("to").pipe(
	Options.withDescription("Newer ref to diff to (defaults to working tree)"),
	Options.optional,
);
const cwdOption = Options.directory("cwd").pipe(
	Options.withDescription("Project root (defaults to the current working directory)"),
	Options.withDefault("."),
);
const packageOption = Options.text("package").pipe(
	Options.withDescription("Restrict output to a single workspace package"),
	Options.optional,
);
const jsonOption = Options.boolean("json").pipe(
	Options.withDescription("Emit JSON (default)"),
	Options.withDefault(false),
);
const markdownOption = Options.boolean("markdown").pipe(
	Options.withDescription("Emit one CSH005 markdown block per workspace package"),
	Options.withDefault(false),
);
/* v8 ignore stop */

/**
 * Render a per-workspace diff as markdown — one frontmatter+section block
 * per affected workspace package, suitable for pasting into individual
 * `.changeset/*.md` files.
 *
 * @internal
 */
export function renderMarkdownBlocks(diffs: ReadonlyArray<WorkspaceDependencyDiff>): string {
	const blocks: string[] = [];
	for (const diff of diffs) {
		const frontmatter = `---\n"${diff.package}": patch\n---`;
		const table = serializeDependencyTableToMarkdown([...diff.rows]);
		blocks.push(`${frontmatter}\n\n## Dependencies\n\n${table}\n`);
	}
	return blocks.join("\n");
}

/**
 * Handler exported for direct invocation in tests.
 *
 * @internal
 */
export function runDepsDetect(
	cwd: string,
	from: Option.Option<string>,
	to: Option.Option<string>,
	pkg: Option.Option<string>,
	json: boolean,
	markdown: boolean,
) {
	return Effect.gen(function* () {
		const service = yield* DepsRegen;

		const plan = yield* service
			.plan({
				cwd,
				includeDevDeps: true,
				...(Option.isSome(pkg) ? { package: pkg.value } : {}),
				...(Option.isSome(from) ? { from: from.value } : {}),
				...(Option.isSome(to) ? { to: to.value } : {}),
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

		const diffs = plan.toWrite.map((entry) => entry.diff);

		// Default to JSON when neither flag is set.
		const emitMarkdown = markdown && !json;

		if (emitMarkdown) {
			yield* Effect.log(renderMarkdownBlocks(diffs));
			return;
		}

		yield* Console.log(JSON.stringify(diffs, null, 2));
	});
}

/* v8 ignore next 7 */
export const depsDetectCommand = Command.make(
	"detect",
	{
		from: fromOption,
		to: toOption,
		cwd: cwdOption,
		package: packageOption,
		json: jsonOption,
		markdown: markdownOption,
	},
	({ from, to, cwd, package: pkg, json, markdown }) => runDepsDetect(cwd, from, to, pkg, json, markdown),
).pipe(Command.withDescription("Compute the dependency diff between two refs"));
