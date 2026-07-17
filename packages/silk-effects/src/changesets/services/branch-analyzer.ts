/**
 * `BranchAnalyzer` service — combine a git diff against the base branch with
 * the per-file classification produced by {@link ConfigInspector}.
 *
 * @remarks
 * This is the single call that the changeset-manager agent uses during its
 * inventory step: one invocation returns the diff, the per-file package
 * attribution, the set of packages affected by the branch, and the list of
 * paths that did not map to any known release surface (so the agent can ask
 * the user about them rather than silently excluding).
 *
 * Base-branch resolution order (highest priority first):
 *
 * 1. Explicit `opts.baseBranch` passed to {@link BranchAnalyzerShape.analyzeBranch}.
 * 2. `baseBranch` from `.changeset/config.json` (surfaced via the inspector).
 * 3. The branch `origin/HEAD` points to (`git symbolic-ref refs/remotes/origin/HEAD`,
 *    via `@effected/git`'s `defaultBranch`).
 * 4. `"main"` as a final fallback.
 *
 * Diff resolution covers everything the user might commit before merging:
 *
 * 1. `git merge-base <base> HEAD` finds the common ancestor.
 * 2. `git diff --name-status <merge-base>` (working tree vs merge-base)
 *    returns every committed, staged, AND unstaged change since the
 *    branch diverged. The two-arg `<merge-base>...HEAD` form would miss
 *    work-in-progress — what the user has open in their editor right
 *    now is exactly the state the agent needs to document.
 * 3. `git ls-files --others --exclude-standard` adds untracked files
 *    (entirely new files not yet `git add`-ed). Each is reported with
 *    status `"added"`.
 *
 * The two results are deduped by path before classification. Renames
 * are reported as `"renamed"` with the new path; the old path is
 * discarded since the classifier needs a single canonical path per
 * file.
 *
 * All git plumbing runs through `@effected/git`'s `Git` service; its typed
 * failures are folded into this package's {@link GitError} so the public
 * error channel stays `ConfigurationError | GitError`.
 *
 * @see {@link BranchAnalyzer} for the service tag
 * @see {@link BranchAnalyzerLive} for the production layer
 * @see {@link ConfigInspector} for the underlying classification service
 *
 */

import type { GitCommandError, GitShape, NameStatusEntry, NotARepositoryError, UnknownRefError } from "@effected/git";
import { Git } from "@effected/git";
import { Context, Effect, Layer, Option, Schema } from "effect";
import type { ChildProcessSpawner } from "effect/unstable/process";
import type { ConfigurationError } from "../errors.js";
import { GitError } from "../errors.js";
import type { ConfigInspectorShape } from "./config-inspector.js";
import { ClassificationReasonSchema, ConfigInspector } from "./config-inspector.js";

/** Git diff status as reported by `--name-status`. @public */
export const FileStatusSchema = Schema.Literals([
	"added",
	"modified",
	"deleted",
	"renamed",
	"copied",
	"typechange",
	"unmerged",
	"unknown",
]).annotate({ identifier: "FileStatus" });
/** Git diff status as reported by `--name-status`. @public */
export type FileStatus = typeof FileStatusSchema.Type;

/** One file entry in the branch analysis output. @public */
export const BranchFileEntrySchema = Schema.Struct({
	path: Schema.String.annotate({
		description: "Repo-relative path (the new path in the case of renames).",
	}),
	status: FileStatusSchema,
	package: Schema.NullOr(Schema.String).annotate({
		description: "Owning package, or null if outside every known release surface.",
	}),
	reason: ClassificationReasonSchema,
}).annotate({ identifier: "BranchFileEntry" });
/** One file entry in the branch analysis output. @public */
export type BranchFileEntry = typeof BranchFileEntrySchema.Type;

/** Structured result of analyzing the current branch against its base. @public */
export const BranchAnalysisSchema = Schema.Struct({
	baseBranch: Schema.String,
	mergeBaseSha: Schema.String,
	files: Schema.Array(BranchFileEntrySchema),
	packagesAffected: Schema.Array(Schema.String),
	unmappedFiles: Schema.Array(Schema.String).annotate({
		description: "Repo-relative paths whose package is null — candidates for an AskUserQuestion.",
	}),
}).annotate({ identifier: "BranchAnalysis" });
/** Structured result of analyzing the current branch against its base. @public */
export type BranchAnalysis = typeof BranchAnalysisSchema.Type;

/**
 * Effect service interface for branch analysis.
 *
 * @public
 */
export interface BranchAnalyzerShape {
	/**
	 * Compute the branch's diff against its base and classify every changed
	 * file against the project's release-surface config.
	 *
	 * @param cwd - Absolute path to the project root
	 * @param opts - Optional overrides
	 * @returns An Effect that succeeds with {@link BranchAnalysis} or fails
	 *   with {@link ConfigurationError} or {@link GitError}
	 */
	readonly analyzeBranch: (
		cwd: string,
		opts?: { readonly baseBranch?: string },
	) => Effect.Effect<BranchAnalysis, ConfigurationError | GitError>;
}

/**
 * Effect service tag for {@link BranchAnalyzerShape}.
 *
 * @example
 * ```typescript
 * import { Effect } from "effect";
 * import { BranchAnalyzer, BranchAnalyzerLive, ConfigInspectorLive } from "@savvy-web/changesets";
 *
 * const program = Effect.gen(function* () {
 *   const analyzer = yield* BranchAnalyzer;
 *   const analysis = yield* analyzer.analyzeBranch(process.cwd());
 *   return analysis.packagesAffected;
 * });
 *
 * Effect.runPromise(
 *   program.pipe(
 *     Effect.provide(BranchAnalyzerLive),
 *     Effect.provide(ConfigInspectorLive),
 *     // ... + ChangesetConfigReaderLive + kit workspace layers + NodeServices.layer
 *   ),
 * );
 * ```
 *
 * @public
 */
export class BranchAnalyzer extends Context.Service<BranchAnalyzer, BranchAnalyzerShape>()("BranchAnalyzer") {}

/* ----------------------------------------------------------------- *
 * Internal helpers
 * ----------------------------------------------------------------- */

/** The union of typed failures a `@effected/git` read can produce. */
type GitFailure = GitCommandError | NotARepositoryError | UnknownRefError;

/**
 * Fold a `@effected/git` typed failure into this package's {@link GitError},
 * preserving the public `ConfigurationError | GitError` error channel.
 */
const toGitError =
	(command: string, cwd: string) =>
	(e: GitFailure): GitError =>
		new GitError({ command, cwd, reason: e.message });

/**
 * Map `@effected/git`'s `NameStatusEntry` status vocabulary onto this
 * package's public {@link FileStatus} literals. The kit spells
 * `"typeChanged"` where the public schema (stable since 0.x) says
 * `"typechange"`, and adds `"broken"` (git's `B`), which the public schema
 * folds into `"unknown"`.
 */
function toFileStatus(status: NameStatusEntry["status"]): FileStatus {
	switch (status) {
		case "typeChanged":
			return "typechange";
		case "broken":
			return "unknown";
		default:
			return status;
	}
}

/* ----------------------------------------------------------------- *
 * Live layer
 * ----------------------------------------------------------------- */

/**
 * The analyzer reads four methods off the kit's full `GitShape` contract
 * (`defaultBranch`, `mergeBase`, `nameStatus`, `untrackedFiles`); the local
 * re-typing this alias replaces was round-3 kit item 3.
 */
type GitReads = Pick<GitShape, "defaultBranch" | "mergeBase" | "nameStatus" | "untrackedFiles">;

/**
 * Resolve the base branch using the documented priority order.
 */
function resolveBaseBranch(
	git: GitReads,
	opts: {
		readonly explicit?: string | undefined;
		readonly configBaseBranch: string;
		readonly cwd: string;
	},
): Effect.Effect<string> {
	if (opts.explicit && opts.explicit.length > 0) return Effect.succeed(opts.explicit);
	if (opts.configBaseBranch && opts.configBaseBranch !== "main") return Effect.succeed(opts.configBaseBranch);
	// Try origin/HEAD; fall through to the config default (typically "main").
	// `defaultBranch` already strips the remote prefix and degrades an unset
	// origin/HEAD to Option.none.
	return git.defaultBranch(opts.cwd).pipe(
		Effect.map(Option.getOrElse(() => opts.configBaseBranch)),
		Effect.catch(() => Effect.succeed(opts.configBaseBranch)),
	);
}

function makeShape(inspector: ConfigInspectorShape, git: GitReads): BranchAnalyzerShape {
	const analyzeBranch = (
		cwd: string,
		opts?: { readonly baseBranch?: string },
	): Effect.Effect<BranchAnalysis, ConfigurationError | GitError> =>
		Effect.gen(function* () {
			const inspected = yield* inspector.inspect(cwd);

			const baseBranch = yield* resolveBaseBranch(git, {
				explicit: opts?.baseBranch,
				configBaseBranch: inspected.baseBranch,
				cwd,
			});

			const mergeBaseSha = (yield* git
				.mergeBase(cwd, baseBranch, "HEAD")
				.pipe(Effect.mapError(toGitError(`git merge-base ${baseBranch} HEAD`, cwd)))).trim();

			// Diff the working tree (not just HEAD) against the merge base —
			// the head-less `nameStatus` form — so committed, staged, and
			// unstaged changes are captured in one pass. Renames arrive with
			// the NEW path in `entry.path`; the old path is discarded.
			const diffEntries = yield* git
				.nameStatus(cwd, { base: mergeBaseSha })
				.pipe(Effect.mapError(toGitError(`git diff --name-status ${mergeBaseSha}`, cwd)));

			// Untracked files are invisible to `git diff`; pick them up
			// separately and report each as `"added"`.
			const untracked = yield* git
				.untrackedFiles(cwd)
				.pipe(Effect.mapError(toGitError("git ls-files --others --exclude-standard", cwd)));

			// The branch's own changeset entries are the artifact being reconciled,
			// never a classification question — reporting them as unmapped is
			// guaranteed noise for every run that already wrote a changeset.
			const isOwnChangeset = (path: string): boolean => path.startsWith(".changeset/") && path.endsWith(".md");

			// Dedupe by path. `git diff` wins on collision (it carries the
			// authoritative status — added/modified/deleted/renamed). Untracked
			// entries fill in for files git has not seen at all.
			const seen = new Set<string>();
			const rawEntries: Array<{ path: string; status: FileStatus }> = [];
			for (const e of diffEntries) {
				if (seen.has(e.path) || isOwnChangeset(e.path)) continue;
				seen.add(e.path);
				rawEntries.push({ path: e.path, status: toFileStatus(e.status) });
			}
			for (const path of untracked) {
				if (seen.has(path) || isOwnChangeset(path)) continue;
				seen.add(path);
				rawEntries.push({ path, status: "added" });
			}

			const paths = rawEntries.map((e) => e.path);
			const classifications = yield* inspector.classify(cwd, paths);

			const files: BranchFileEntry[] = rawEntries.map((entry, idx) => {
				const c = classifications[idx];
				return {
					path: entry.path,
					status: entry.status,
					package: c?.package ?? null,
					reason: c?.reason ?? null,
				};
			});

			const packagesAffected = Array.from(
				new Set(files.map((f) => f.package).filter((p): p is string => p !== null)),
			).sort();

			const unmappedFiles = files.filter((f) => f.package === null).map((f) => f.path);

			return {
				baseBranch,
				mergeBaseSha,
				files,
				packagesAffected,
				unmappedFiles,
			};
		});

	return { analyzeBranch };
}

/**
 * Live layer for {@link BranchAnalyzer}.
 *
 * Requires {@link ConfigInspector} (which in turn requires
 * `ChangesetConfigReader` and `WorkspaceDiscovery`) and a
 * `ChildProcessSpawner` (satisfied by `NodeServices.layer`) for the
 * internally-composed `@effected/git` layer.
 *
 * @public
 */
export const BranchAnalyzerLive: Layer.Layer<
	BranchAnalyzer,
	never,
	ConfigInspector | ChildProcessSpawner.ChildProcessSpawner
> = Layer.effect(
	BranchAnalyzer,
	Effect.gen(function* () {
		const inspector = yield* ConfigInspector;
		const git = yield* Git;
		return makeShape(inspector, git);
	}),
).pipe(Layer.provide(Git.layer));

/**
 * Test factory — build a {@link BranchAnalyzer} that returns a fixed
 * {@link BranchAnalysis} for any input.
 *
 * @public
 */
export function makeBranchAnalyzerTest(fixed: BranchAnalysis): Layer.Layer<BranchAnalyzer> {
	return Layer.succeed(BranchAnalyzer, {
		analyzeBranch: () => Effect.succeed(fixed),
	});
}
