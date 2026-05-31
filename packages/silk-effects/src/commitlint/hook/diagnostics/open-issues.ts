/**
 * Open-issue lookup via gh CLI, cached on disk.
 *
 * @internal
 */
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { Effect } from "effect";
import { readCache, writeCache } from "./cache.js";

const execFileP = promisify(execFile);

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

export function fetchAndCacheOpenIssues(cachePath: string): Effect.Effect<OpenIssue[] | null> {
	return Effect.gen(function* () {
		const repoResult = yield* Effect.tryPromise(() =>
			execFileP("gh", ["repo", "view", "--json", "nameWithOwner", "-q", ".nameWithOwner"]),
		);
		const repo = repoResult.stdout.trim();
		if (!repo) return null;

		const listResult = yield* Effect.tryPromise(() =>
			execFileP("gh", ["issue", "list", "--repo", repo, "--state", "open", "--limit", "20", "--json", "number,title"]),
		);
		const parsed = JSON.parse(listResult.stdout) as OpenIssue[];
		yield* writeCache(cachePath, parsed);
		return parsed;
	}).pipe(Effect.orElseSucceed(() => null));
}

export function readOrFetchOpenIssues(cachePath: string): Effect.Effect<OpenIssue[] | null> {
	return Effect.gen(function* () {
		const cached = yield* readOpenIssuesFromCache(cachePath);
		if (cached !== null) return cached;
		return yield* fetchAndCacheOpenIssues(cachePath);
	});
}
