/**
 * Open-issue lookup via gh CLI, cached on disk.
 *
 * @remarks
 * The `gh` invocations run through `@effected/commands`' `Run`: the repo
 * lookup is `Run.text`, the issue list is `Run.json` decoded against
 * {@link OpenIssue}. Any failure (gh missing, not logged in, no repo, a
 * non-zero exit, output that is not JSON or not an issue list) degrades to
 * `null` and caches nothing, preserving the never-fails contract.
 *
 * @internal
 */
import { resolve } from "node:path";
import { Run } from "@effected/commands";
import { Git } from "@effected/git";
import { Effect, Schema } from "effect";
import type { ChildProcessSpawner } from "effect/process";
import { ChildProcess } from "effect/process";
import { readCache, writeCache } from "./cache.js";

/** One open issue as `gh issue list --json number,title` prints it. */
export const OpenIssue = Schema.Struct({ number: Schema.Number, title: Schema.String });

/** The decoded {@link (OpenIssue:variable)}. */
export type OpenIssue = typeof OpenIssue.Type;

const OpenIssues = Schema.Array(OpenIssue);

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
		const repo = yield* Run.text(
			ChildProcess.make("gh", ["repo", "view", "--json", "nameWithOwner", "-q", ".nameWithOwner"]),
		);
		if (!repo) return null;

		const issues = yield* Run.json(
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
			OpenIssues,
		);
		const parsed = [...issues];
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
