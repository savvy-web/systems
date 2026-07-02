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
