/**
 * Git helpers for the changesets deps regen/detect orchestration.
 *
 * @remarks
 * `WorkspaceSnapshots` (from `@effected/workspaces`) reads both sides of a
 * dependency diff. The one git operation it does not cover is resolving the
 * default `--from` ref — the merge-base with the base branch — which is
 * delegated to `@effected/git`'s `Git` service (spawning through
 * `ChildProcessSpawner`, provided at the app edge).
 *
 * @internal
 */

import { basename } from "node:path";
import { Git } from "@effected/git";
import { Effect, Option } from "effect";

import { GitError } from "../errors.js";

/**
 * Run `git merge-base <base> HEAD`, returning the SHA. Errors propagate
 * as {@link GitError}.
 *
 * @internal
 */
export function gitMergeBase(cwd: string, base: string): Effect.Effect<string, GitError, Git> {
	return Effect.gen(function* () {
		const git = yield* Git;
		return yield* git.mergeBase(cwd, base, "HEAD").pipe(
			Effect.mapError(
				(error) =>
					new GitError({
						command: `git merge-base ${base} HEAD`,
						cwd,
						reason: error.message,
					}),
			),
		);
	});
}

/**
 * Pin `ref` to the commit it names right now (`git rev-parse --verify`).
 *
 * @remarks
 * `WorkspaceSnapshots.at(ref)` caches per ref STRING for the layer's
 * lifetime, which is only sound for an immutable ref. A branch or tag name
 * handed to a long-lived host (savvy-mcp) would otherwise keep answering
 * from the commit it named on first use (savvy-web/systems#715); keying the
 * snapshot on the SHA makes every cache hit correct by construction.
 *
 * Tolerant: an unresolvable ref, or a `cwd` outside a git repository, hands
 * back `ref` unchanged, so the snapshot read that follows reports the
 * failure in its own typed terms (and synthetic refs keep working against
 * test doubles).
 *
 * @internal
 */
export function gitResolveRef(cwd: string, ref: string): Effect.Effect<string, never, Git> {
	return Effect.gen(function* () {
		const git = yield* Git;
		return yield* git.revParse(cwd, ref).pipe(Effect.orElseSucceed(() => ref));
	});
}

/**
 * List the basenames of `.changeset/*.md` files tracked at `ref` (e.g. the
 * merge base), via `git ls-tree -r`. Used by `DepsRegen.plan()`
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
export function gitListChangesetFilesAtRef(cwd: string, ref: string): Effect.Effect<ReadonlySet<string>, never, Git> {
	return Effect.gen(function* () {
		const git = yield* Git;
		const entries = yield* git
			.lsTree(cwd, ref, { pathspec: [".changeset"] })
			.pipe(Effect.catch(() => Effect.succeed([])));
		return new Set(entries.filter((entry) => entry.path.trim().length > 0).map((entry) => basename(entry.path)));
	});
}

/**
 * Read one tracked file's contents at `ref` via `git show <ref>:<path>`,
 * as `Option.some(text)`; `Option.none()` when the file is absent at that
 * ref, `cwd` is not a git repository, or `ref` does not resolve.
 *
 * @remarks
 * Tolerant of exactly the three "nothing to read" shapes, for the same
 * reason as {@link gitListChangesetFilesAtRef}: the consumer
 * (`DepsRegen.plan()`'s hook-replay guard) treats them as "nothing
 * declared", and a synthetic ref against a bare tmpdir must not turn a unit
 * test into a git failure. Any OTHER failure — git itself erroring — is a
 * {@link GitError}: swallowing it would let an operational fault read as an
 * empty declaration and silently bypass the guard.
 *
 * @internal
 */
export function gitShowFileAtRef(
	cwd: string,
	ref: string,
	path: string,
): Effect.Effect<Option.Option<string>, GitError, Git> {
	return Effect.gen(function* () {
		const git = yield* Git;
		return yield* git.show(cwd, ref, path).pipe(
			Effect.catchTags({
				NotARepositoryError: () => Effect.succeed(Option.none<string>()),
				UnknownRefError: () => Effect.succeed(Option.none<string>()),
			}),
			Effect.mapError((error) => new GitError({ command: `git show ${ref}:${path}`, cwd, reason: error.message })),
		);
	});
}
