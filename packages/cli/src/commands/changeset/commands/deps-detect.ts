/**
 * `deps detect` command — read-only dependency-diff inspection.
 *
 * @remarks
 * Computes the per-workspace-package dependency changes between two git
 * refs and renders them either as structured JSON (one row per change)
 * or as ready-to-paste CSH005 markdown. No file writes.
 *
 * Defaults:
 * - `--from` → `git merge-base <baseBranch> HEAD`
 * - `--to`   → working tree (i.e., `HEAD` plus staged + unstaged + untracked,
 *   matching `analyze-branch`'s coverage). Passed as the special value
 *   `WORKTREE` to {@link WorkspaceSnapshotReader} — implementations resolve
 *   this against the live working tree rather than `git show`.
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

import { resolve } from "node:path";
import { Command, Options } from "@effect/cli";
import { Changesets } from "@savvy-web/silk-effects";
import { Effect, Option } from "effect";
import { WorkspaceDiscovery } from "workspaces-effect";

type WorkspaceDependencyDiff = Changesets.WorkspaceDependencyDiff;
const {
	ConfigInspector,
	WorkspaceSnapshotReader,
	computeWorkspaceDependencyDiffs,
	gitMergeBase,
	listPublishablePackageNames,
	serializeDependencyTableToMarkdown,
	snapshotFromWorktree,
} = Changesets;

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
		const reader = yield* WorkspaceSnapshotReader;
		const resolvedCwd = resolve(cwd);

		// Resolve `--from` (default: merge-base with config's baseBranch)
		let fromRef = Option.getOrUndefined(from);
		if (!fromRef) {
			const inspector = yield* ConfigInspector;
			const inspected = yield* inspector
				.inspect(resolvedCwd)
				.pipe(
					Effect.catchTag("ConfigurationError", () => Effect.succeed({ baseBranch: "main" } as { baseBranch: string })),
				);
			fromRef = yield* gitMergeBase(resolvedCwd, inspected.baseBranch).pipe(
				Effect.catchTag("GitError", (err) => {
					process.exitCode = 1;
					return Effect.fail(err);
				}),
			);
		}

		// Resolve --to (default: working tree)
		const toRef = Option.getOrUndefined(to);

		const beforeSnaps = yield* reader.snapshotAt(resolvedCwd, fromRef).pipe(
			Effect.catchTag("GitError", (err) => {
				process.exitCode = 1;
				return Effect.fail(err);
			}),
		);

		const afterSnaps = toRef
			? yield* reader.snapshotAt(resolvedCwd, toRef).pipe(
					Effect.catchTag("GitError", (err) => {
						process.exitCode = 1;
						return Effect.fail(err);
					}),
				)
			: snapshotFromWorktree(resolvedCwd);

		let diffs = computeWorkspaceDependencyDiffs(beforeSnaps, afterSnaps);
		const targetPkg = Option.getOrUndefined(pkg);
		if (targetPkg) {
			// Explicit --package overrides the publishability filter; users
			// asking for a specific package by name get an answer regardless.
			diffs = diffs.filter((d) => d.package === targetPkg);
		} else {
			// Default: filter out workspace packages that cannot publish.
			// Their dep changes never reach a release, so a changeset for
			// them would mislead anyone reading the CHANGELOG.
			const discovery = yield* WorkspaceDiscovery;
			const livePackages = yield* discovery.listPackages(resolvedCwd).pipe(Effect.catchAll(() => Effect.succeed([])));
			const publishable = yield* listPublishablePackageNames(livePackages);
			diffs = diffs.filter((d) => publishable.has(d.package));
		}

		// Default to JSON when neither flag is set.
		const emitMarkdown = markdown && !json;

		if (emitMarkdown) {
			yield* Effect.log(renderMarkdownBlocks(diffs));
			return;
		}

		yield* Effect.log(JSON.stringify(diffs, null, 2));
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
