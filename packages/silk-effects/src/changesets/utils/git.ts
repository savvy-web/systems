/**
 * Git helpers for the changesets deps regen/detect orchestration.
 *
 * @remarks
 * `PointInTimeWorkspace` (from `workspaces-effect`) reads both sides of a
 * dependency diff over `CommandExecutor`. The one git operation it does not
 * cover is resolving the default `--from` ref — the merge-base with the base
 * branch — which stays here as a synchronous `execFileSync` shell-out.
 *
 * @internal
 */

import { execFileSync } from "node:child_process";
import { basename } from "node:path";
import { Effect } from "effect";

import { GitError } from "../errors.js";

/**
 * Run `git merge-base <base> HEAD`, returning the SHA. Errors propagate
 * as {@link GitError}.
 *
 * @internal
 */
export function gitMergeBase(cwd: string, base: string): Effect.Effect<string, GitError> {
	return Effect.try({
		try: () =>
			execFileSync("git", ["merge-base", base, "HEAD"], {
				cwd,
				encoding: "utf8",
				stdio: ["ignore", "pipe", "pipe"],
			}).trim(),
		catch: (error) => {
			const stderr = (error as { stderr?: Buffer | string }).stderr;
			const text = typeof stderr === "string" ? stderr : (stderr?.toString() ?? "");
			return new GitError({
				command: `git merge-base ${base} HEAD`,
				cwd,
				reason: text.trim() || ((error as Error).message ?? String(error)),
			});
		},
	});
}

/**
 * List the basenames of `.changeset/*.md` files tracked at `ref` (e.g. the
 * merge base), via `git ls-tree -r --name-only`. Used by `DepsRegen.plan()`
 * to protect changesets authored by already-merged PRs from being deleted by
 * an unrelated branch's regen run (#258).
 *
 * @remarks
 * Deliberately tolerant, unlike {@link gitMergeBase}: `cwd` may not be a git
 * repository at all (many `DepsRegen` unit tests pass synthetic refs like
 * `"BEFORE"`/`"AFTER"` against a bare tmpdir), and an unresolvable ref is a
 * plausible caller mistake rather than a fatal condition. Either failure mode
 * resolves to an empty set — "nothing protected" — rather than propagating a
 * {@link GitError}, so a missing/invalid git context degrades the
 * authorship filter to a no-op instead of blocking the whole plan.
 *
 * @internal
 */
export function gitListChangesetFilesAtRef(cwd: string, ref: string): Effect.Effect<ReadonlySet<string>> {
	return Effect.sync(() => {
		try {
			const out = execFileSync("git", ["ls-tree", "-r", "--name-only", ref, "--", ".changeset"], {
				cwd,
				encoding: "utf8",
				stdio: ["ignore", "pipe", "pipe"],
			});
			return new Set(
				out
					.split(/\r?\n/)
					.filter((line) => line.trim().length > 0)
					.map((path) => basename(path)),
			);
		} catch {
			return new Set<string>();
		}
	});
}
