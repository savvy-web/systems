/**
 * Open-issue lookup via gh CLI, cached on disk.
 *
 * @remarks
 * The `gh` invocations are not git, so they stay hand-rolled — the spawn
 * mechanism moved from promisified `node:child_process.execFile` onto
 * `effect/process` `ChildProcess`. Any failure (gh missing, not
 * logged in, no repo, malformed JSON) degrades to `null`, preserving the
 * never-fails contract of the v3 implementation.
 *
 * @internal
 */
import { resolve } from "node:path";
import { Git } from "@effected/git";
import { Effect } from "effect";
import { ChildProcess, ChildProcessSpawner } from "effect/process";
import { readCache, writeCache } from "./cache.js";

export interface OpenIssue {
	number: number;
	title: string;
}

export const ISSUES_CACHE_TTL_SECONDS = 600;

/** Relative path under the project root where the open-issues cache lives. */
export const ISSUES_CACHE_RELATIVE_PATH = ".claude/cache/issues.json";

/**
 * Resolve the absolute open-issues cache path.
 *
 * @remarks
 * The root is `CLAUDE_PROJECT_DIR` when set, otherwise the git repository
 * root of `cwd`, and only outside any repository `cwd` itself. Falling back
 * straight to `cwd` left a stray cache under whichever package directory a
 * hook happened to run from (savvy-web/systems#762).
 */
export function resolveIssuesCachePath(
	options: { readonly cwd?: string; readonly projectDir?: string | undefined } = {},
): Effect.Effect<string, never, Git> {
	const cwd = options.cwd ?? process.cwd();
	const projectDir = "projectDir" in options ? options.projectDir : process.env.CLAUDE_PROJECT_DIR;
	return Effect.gen(function* () {
		if (projectDir) return resolve(projectDir, ISSUES_CACHE_RELATIVE_PATH);
		const git = yield* Git;
		const root = yield* git.repoRoot(cwd).pipe(Effect.orElseSucceed(() => cwd));
		return resolve(root, ISSUES_CACHE_RELATIVE_PATH);
	});
}

export function readOpenIssuesFromCache(
	cachePath: string,
	ttlSeconds: number = ISSUES_CACHE_TTL_SECONDS,
): Effect.Effect<OpenIssue[] | null> {
	return readCache<OpenIssue[]>(cachePath, ttlSeconds);
}

export function fetchAndCacheOpenIssues(
	cachePath: string,
): Effect.Effect<OpenIssue[] | null, never, ChildProcessSpawner.ChildProcessSpawner> {
	return Effect.gen(function* () {
		const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;

		const repoStdout = yield* spawner.string(
			ChildProcess.make("gh", ["repo", "view", "--json", "nameWithOwner", "-q", ".nameWithOwner"]),
		);
		const repo = repoStdout.trim();
		if (!repo) return null;

		const listStdout = yield* spawner.string(
			ChildProcess.make("gh", [
				"issue",
				"list",
				"--repo",
				repo,
				"--state",
				"open",
				"--limit",
				"20",
				"--json",
				"number,title",
			]),
		);
		const parsed = yield* Effect.try(() => JSON.parse(listStdout) as OpenIssue[]);
		yield* writeCache(cachePath, parsed);
		return parsed;
	}).pipe(Effect.orElseSucceed(() => null));
}

export function readOrFetchOpenIssues(
	cachePath: string,
): Effect.Effect<OpenIssue[] | null, never, ChildProcessSpawner.ChildProcessSpawner> {
	return Effect.gen(function* () {
		const cached = yield* readOpenIssuesFromCache(cachePath);
		if (cached !== null) return cached;
		return yield* fetchAndCacheOpenIssues(cachePath);
	});
}
