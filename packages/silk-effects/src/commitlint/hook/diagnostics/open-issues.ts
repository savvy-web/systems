/**
 * Open-issue lookup via gh CLI, cached on disk.
 *
 * @remarks
 * The `gh` invocations are not git, so they stay hand-rolled — the spawn
 * mechanism moved from promisified `node:child_process.execFile` onto
 * `effect/unstable/process` `ChildProcess`. Any failure (gh missing, not
 * logged in, no repo, malformed JSON) degrades to `null`, preserving the
 * never-fails contract of the v3 implementation.
 *
 * @internal
 */
import { Effect } from "effect";
import { ChildProcess, ChildProcessSpawner } from "effect/unstable/process";
import { readCache, writeCache } from "./cache.js";

export interface OpenIssue {
	number: number;
	title: string;
}

export const ISSUES_CACHE_TTL_SECONDS = 600;

/** Relative path under CLAUDE_PROJECT_DIR where the open-issues cache lives. */
export const ISSUES_CACHE_RELATIVE_PATH = ".claude/cache/issues.json";

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
