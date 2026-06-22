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
 * 3. The branch `origin/HEAD` points to (`git symbolic-ref refs/remotes/origin/HEAD`).
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
 * @see {@link BranchAnalyzer} for the service tag
 * @see {@link BranchAnalyzerLive} for the production layer
 * @see {@link ConfigInspector} for the underlying classification service
 *
 */

import { execFileSync } from "node:child_process";
import { Context, Effect, Layer, Schema } from "effect";
import type { ConfigurationError } from "../errors.js";
import { GitError } from "../errors.js";
import { ClassificationReasonSchema, ConfigInspector } from "./config-inspector.js";

/** Git diff status as reported by `--name-status`. @public */
export const FileStatusSchema = Schema.Literal(
	"added",
	"modified",
	"deleted",
	"renamed",
	"copied",
	"typechange",
	"unmerged",
	"unknown",
).annotations({ identifier: "FileStatus" });
/** Git diff status as reported by `--name-status`. @public */
export type FileStatus = Schema.Schema.Type<typeof FileStatusSchema>;

/** One file entry in the branch analysis output. @public */
export const BranchFileEntrySchema = Schema.Struct({
	path: Schema.String.annotations({
		description: "Repo-relative path (the new path in the case of renames).",
	}),
	status: FileStatusSchema,
	package: Schema.NullOr(Schema.String).annotations({
		description: "Owning package, or null if outside every known release surface.",
	}),
	reason: ClassificationReasonSchema,
}).annotations({ identifier: "BranchFileEntry" });
/** One file entry in the branch analysis output. @public */
export type BranchFileEntry = Schema.Schema.Type<typeof BranchFileEntrySchema>;

/** Structured result of analyzing the current branch against its base. @public */
export const BranchAnalysisSchema = Schema.Struct({
	baseBranch: Schema.String,
	mergeBaseSha: Schema.String,
	files: Schema.Array(BranchFileEntrySchema),
	packagesAffected: Schema.Array(Schema.String),
	unmappedFiles: Schema.Array(Schema.String).annotations({
		description: "Repo-relative paths whose package is null — candidates for an AskUserQuestion.",
	}),
}).annotations({ identifier: "BranchAnalysis" });
/** Structured result of analyzing the current branch against its base. @public */
export type BranchAnalysis = Schema.Schema.Type<typeof BranchAnalysisSchema>;

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

const _tag = Context.Tag("BranchAnalyzer");

/**
 * Base class for {@link BranchAnalyzer}.
 *
 * @privateRemarks
 * Effect's `Context.Tag` creates an anonymous base class that api-extractor
 * cannot follow without an explicit export. Do not delete.
 *
 * @internal
 */
export const BranchAnalyzerBase = _tag<BranchAnalyzer, BranchAnalyzerShape>();

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
 *     // ... + ChangesetConfigReaderLive + WorkspacesLive + NodeContext.layer
 *   ),
 * );
 * ```
 *
 * @public
 */
export class BranchAnalyzer extends BranchAnalyzerBase {}

/* ----------------------------------------------------------------- *
 * Internal helpers
 * ----------------------------------------------------------------- */

/**
 * Invoke `git` with the given args under `cwd` and return stdout. On
 * non-zero exit (or any throw), maps to a {@link GitError} carrying the
 * command, cwd, and captured stderr.
 */
function runGit(cwd: string, args: ReadonlyArray<string>): Effect.Effect<string, GitError> {
	return Effect.try({
		try: () =>
			execFileSync("git", args as string[], {
				cwd,
				encoding: "utf8",
				stdio: ["ignore", "pipe", "pipe"],
			}),
		catch: (error) => {
			const e = error as { stderr?: string | Buffer; message?: string };
			const stderr = typeof e.stderr === "string" ? e.stderr : (e.stderr?.toString() ?? "");
			return new GitError({
				command: `git ${args.join(" ")}`,
				cwd,
				reason: stderr.trim() || e.message || String(error),
			});
		},
	});
}

const STATUS_MAP: Record<string, FileStatus> = {
	A: "added",
	M: "modified",
	D: "deleted",
	R: "renamed",
	C: "copied",
	T: "typechange",
	U: "unmerged",
};

function statusFromCode(code: string): FileStatus {
	// Rename / copy status codes are followed by a similarity percentage:
	// "R100", "C75", etc. Strip everything after the leading letter.
	const head = code.charAt(0);
	return STATUS_MAP[head] ?? "unknown";
}

/**
 * Parse `git diff --name-status -z` output into one entry per changed file.
 *
 * `-z` separates fields with NUL bytes and avoids the per-record `\n`
 * delimiter, so paths containing spaces or special characters round-trip
 * cleanly. Rename and copy entries occupy three NUL-separated tokens
 * (status, old path, new path) instead of two; everything else is two.
 */
function parseNameStatus(output: string): ReadonlyArray<{ readonly path: string; readonly status: FileStatus }> {
	if (output.length === 0) return [];
	const tokens = output.split("\0");
	// Trailing empty token after the last NUL byte — drop it.
	if (tokens[tokens.length - 1] === "") tokens.pop();

	const entries: Array<{ path: string; status: FileStatus }> = [];
	for (let i = 0; i < tokens.length; ) {
		const code = tokens[i] ?? "";
		if (code.length === 0) {
			/* v8 ignore next 2 -- defensive guard; trailing empties stripped at parse time */
			i += 1;
			continue;
		}
		const status = statusFromCode(code);
		if (status === "renamed" || status === "copied") {
			// status + oldPath + newPath
			const newPath = tokens[i + 2] ?? "";
			if (newPath.length > 0) entries.push({ path: newPath, status });
			i += 3;
		} else {
			const path = tokens[i + 1] ?? "";
			if (path.length > 0) entries.push({ path, status });
			i += 2;
		}
	}
	return entries;
}

/**
 * Parse a NUL-separated list of paths (e.g., `git ls-files -z` output) into
 * an array of strings, dropping any trailing empty entry left by the final
 * NUL byte.
 */
function parseNulSeparatedPaths(output: string): ReadonlyArray<string> {
	if (output.length === 0) return [];
	const tokens = output.split("\0");
	if (tokens[tokens.length - 1] === "") tokens.pop();
	return tokens.filter((t) => t.length > 0);
}

/**
 * Resolve the base branch using the documented priority order.
 */
function resolveBaseBranch(opts: {
	readonly explicit?: string | undefined;
	readonly configBaseBranch: string;
	readonly cwd: string;
}): Effect.Effect<string, GitError> {
	if (opts.explicit && opts.explicit.length > 0) return Effect.succeed(opts.explicit);
	if (opts.configBaseBranch && opts.configBaseBranch !== "main") return Effect.succeed(opts.configBaseBranch);
	// Try origin/HEAD; fall through to the config default (typically "main")
	return runGit(opts.cwd, ["symbolic-ref", "--quiet", "--short", "refs/remotes/origin/HEAD"]).pipe(
		/* v8 ignore start -- callback only reachable with a remote that exposes origin/HEAD */
		Effect.map((stdout) => {
			const trimmed = stdout.trim();
			// "origin/main" → "main"; fall back to configured base when stdout is empty
			return trimmed.length > 0 ? trimmed.replace(/^origin\//, "") : opts.configBaseBranch;
		}),
		/* v8 ignore stop */
		Effect.catchAll(() => Effect.succeed(opts.configBaseBranch)),
	);
}

/* ----------------------------------------------------------------- *
 * Live layer
 * ----------------------------------------------------------------- */

function makeShape(inspector: typeof ConfigInspector.Service): BranchAnalyzerShape {
	const analyzeBranch = (
		cwd: string,
		opts?: { readonly baseBranch?: string },
	): Effect.Effect<BranchAnalysis, ConfigurationError | GitError> =>
		Effect.gen(function* () {
			const inspected = yield* inspector.inspect(cwd);

			const baseBranch = yield* resolveBaseBranch({
				explicit: opts?.baseBranch,
				configBaseBranch: inspected.baseBranch,
				cwd,
			});

			const mergeBaseSha = (yield* runGit(cwd, ["merge-base", baseBranch, "HEAD"])).trim();

			// Use the single-arg `git diff <merge-base>` form so the working
			// tree (not just HEAD) is compared against the merge base — that
			// captures committed, staged, and unstaged changes in one pass.
			const diffOutput = yield* runGit(cwd, ["diff", "--name-status", "-z", mergeBaseSha]);
			const diffEntries = parseNameStatus(diffOutput);

			// Untracked files are invisible to `git diff`; pick them up
			// separately via `ls-files --others --exclude-standard` and
			// report each as `"added"`.
			const untrackedOutput = yield* runGit(cwd, ["ls-files", "-z", "--others", "--exclude-standard"]);
			const untrackedEntries = parseNulSeparatedPaths(untrackedOutput).map((path) => ({
				path,
				status: "added" as FileStatus,
			}));

			// Dedupe by path. `git diff` wins on collision (it carries the
			// authoritative status — added/modified/deleted/renamed). Untracked
			// entries fill in for files git has not seen at all.
			const seen = new Set<string>();
			const rawEntries: Array<{ path: string; status: FileStatus }> = [];
			for (const e of diffEntries) {
				if (seen.has(e.path)) continue;
				seen.add(e.path);
				rawEntries.push(e);
			}
			for (const e of untrackedEntries) {
				if (seen.has(e.path)) continue;
				seen.add(e.path);
				rawEntries.push(e);
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
 * `ChangesetConfigReader` and `WorkspaceDiscovery`).
 *
 * @public
 */
export const BranchAnalyzerLive: Layer.Layer<BranchAnalyzer, never, ConfigInspector> = Layer.effect(
	BranchAnalyzer,
	Effect.gen(function* () {
		const inspector = yield* ConfigInspector;
		return makeShape(inspector);
	}),
);

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
