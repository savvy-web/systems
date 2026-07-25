/**
 * Tests for the `gitListChangesetFilesAtRef` merge-base authorship helper
 * added for #258 — never delete a pure dependency changeset that already
 * existed at the merge base.
 */

import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { NodeServices } from "@effect/platform-node";
import { expect, layer } from "@effect/vitest";
import { Git as GitService } from "@effected/git";
import { Effect, Layer } from "effect";
import { gitListChangesetFilesAtRef } from "../../src/changesets/utils/git.js";

/**
 * The real `@effected/git` layer over NodeServices. Constant for the whole
 * suite (the repo path is a per-call argument, not a layer binding), so it is
 * provided once at the suite boundary.
 *
 * These tests spawn real `git` under `it.effect`'s virtual TestClock, and
 * `@effected/git` wraps every invocation in `Effect.timeoutOrElse({ duration:
 * 30s })` (Git.js:190) — which is clock-backed. Verified empirically that this
 * does NOT hang: the timeout is a race, the real subprocess completes via async
 * I/O and wins, and the virtual sleep arm simply never fires. The 30s guard
 * goes inert under TestClock rather than stalling the test.
 */
const GitLive = GitService.layer.pipe(Layer.provide(NodeServices.layer));

function git(cwd: string, ...args: string[]): string {
	return execFileSync("git", args, {
		cwd,
		encoding: "utf8",
		env: {
			...process.env,
			GIT_AUTHOR_NAME: "Test",
			GIT_AUTHOR_EMAIL: "t@example.com",
			GIT_COMMITTER_NAME: "Test",
			GIT_COMMITTER_EMAIL: "t@example.com",
		},
	});
}

layer(GitLive)("gitListChangesetFilesAtRef", (it) => {
	it.effect("lists the basenames of .changeset/*.md files tracked at a real ref", () =>
		Effect.gen(function* () {
			const dir = mkdtempSync(join(tmpdir(), "git-list-changesets-"));
			mkdirSync(join(dir, ".changeset"), { recursive: true });
			writeFileSync(join(dir, ".changeset", "committed-one.md"), ["---", '"@x/a": patch', "---", ""].join("\n"));
			writeFileSync(join(dir, ".changeset", "committed-two.md"), ["---", '"@x/b": patch', "---", ""].join("\n"));

			git(dir, "init", "--quiet", "-b", "main");
			git(dir, "config", "commit.gpgsign", "false");
			git(dir, "add", "-A");
			git(dir, "commit", "--quiet", "-m", "base commit");

			const result = yield* gitListChangesetFilesAtRef(dir, "HEAD");
			expect(result).toEqual(new Set(["committed-one.md", "committed-two.md"]));
		}),
	);

	it.effect("does not include a file added AFTER the cited ref (working-tree-only, not yet committed)", () =>
		Effect.gen(function* () {
			const dir = mkdtempSync(join(tmpdir(), "git-list-changesets-wt-"));
			mkdirSync(join(dir, ".changeset"), { recursive: true });
			writeFileSync(join(dir, ".changeset", "committed.md"), ["---", '"@x/a": patch', "---", ""].join("\n"));

			git(dir, "init", "--quiet", "-b", "main");
			git(dir, "config", "commit.gpgsign", "false");
			git(dir, "add", "-A");
			git(dir, "commit", "--quiet", "-m", "base commit");

			// Working-tree-only addition, never committed.
			writeFileSync(join(dir, ".changeset", "uncommitted.md"), ["---", '"@x/b": patch', "---", ""].join("\n"));

			const result = yield* gitListChangesetFilesAtRef(dir, "HEAD");
			expect(result).toEqual(new Set(["committed.md"]));
		}),
	);

	it.effect("tolerantly resolves to an empty set (never throws) when cwd is not a git repo", () =>
		Effect.gen(function* () {
			const dir = mkdtempSync(join(tmpdir(), "git-list-changesets-norepo-"));
			mkdirSync(join(dir, ".changeset"), { recursive: true });
			writeFileSync(join(dir, ".changeset", "whatever.md"), ["---", '"@x/a": patch', "---", ""].join("\n"));

			const result = yield* gitListChangesetFilesAtRef(dir, "HEAD");
			expect(result).toEqual(new Set());
		}),
	);

	it.effect("tolerantly resolves to an empty set when the ref does not exist in a real repo", () =>
		Effect.gen(function* () {
			const dir = mkdtempSync(join(tmpdir(), "git-list-changesets-badref-"));
			mkdirSync(join(dir, ".changeset"), { recursive: true });
			writeFileSync(join(dir, ".changeset", "committed.md"), ["---", '"@x/a": patch', "---", ""].join("\n"));

			git(dir, "init", "--quiet", "-b", "main");
			git(dir, "config", "commit.gpgsign", "false");
			git(dir, "add", "-A");
			git(dir, "commit", "--quiet", "-m", "base commit");

			const result = yield* gitListChangesetFilesAtRef(dir, "not-a-real-ref");
			expect(result).toEqual(new Set());
		}),
	);
});
