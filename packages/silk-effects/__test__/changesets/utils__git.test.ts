/**
 * Tests for the `gitListChangesetFilesAtRef` merge-base authorship helper
 * added for #258 — never delete a pure dependency changeset that already
 * existed at the merge base.
 */

import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Effect } from "effect";
import { describe, expect, it } from "vitest";
import { gitListChangesetFilesAtRef } from "../../src/changesets/utils/git.js";

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

describe("gitListChangesetFilesAtRef", () => {
	it("lists the basenames of .changeset/*.md files tracked at a real ref", async () => {
		const dir = mkdtempSync(join(tmpdir(), "git-list-changesets-"));
		mkdirSync(join(dir, ".changeset"), { recursive: true });
		writeFileSync(join(dir, ".changeset", "committed-one.md"), ["---", '"@x/a": patch', "---", ""].join("\n"));
		writeFileSync(join(dir, ".changeset", "committed-two.md"), ["---", '"@x/b": patch', "---", ""].join("\n"));

		git(dir, "init", "--quiet", "-b", "main");
		git(dir, "config", "commit.gpgsign", "false");
		git(dir, "add", "-A");
		git(dir, "commit", "--quiet", "-m", "base commit");

		const result = await Effect.runPromise(gitListChangesetFilesAtRef(dir, "HEAD"));
		expect(result).toEqual(new Set(["committed-one.md", "committed-two.md"]));
	});

	it("does not include a file added AFTER the cited ref (working-tree-only, not yet committed)", async () => {
		const dir = mkdtempSync(join(tmpdir(), "git-list-changesets-wt-"));
		mkdirSync(join(dir, ".changeset"), { recursive: true });
		writeFileSync(join(dir, ".changeset", "committed.md"), ["---", '"@x/a": patch', "---", ""].join("\n"));

		git(dir, "init", "--quiet", "-b", "main");
		git(dir, "config", "commit.gpgsign", "false");
		git(dir, "add", "-A");
		git(dir, "commit", "--quiet", "-m", "base commit");

		// Working-tree-only addition, never committed.
		writeFileSync(join(dir, ".changeset", "uncommitted.md"), ["---", '"@x/b": patch', "---", ""].join("\n"));

		const result = await Effect.runPromise(gitListChangesetFilesAtRef(dir, "HEAD"));
		expect(result).toEqual(new Set(["committed.md"]));
	});

	it("tolerantly resolves to an empty set (never throws) when cwd is not a git repo", async () => {
		const dir = mkdtempSync(join(tmpdir(), "git-list-changesets-norepo-"));
		mkdirSync(join(dir, ".changeset"), { recursive: true });
		writeFileSync(join(dir, ".changeset", "whatever.md"), ["---", '"@x/a": patch', "---", ""].join("\n"));

		const result = await Effect.runPromise(gitListChangesetFilesAtRef(dir, "HEAD"));
		expect(result).toEqual(new Set());
	});

	it("tolerantly resolves to an empty set when the ref does not exist in a real repo", async () => {
		const dir = mkdtempSync(join(tmpdir(), "git-list-changesets-badref-"));
		mkdirSync(join(dir, ".changeset"), { recursive: true });
		writeFileSync(join(dir, ".changeset", "committed.md"), ["---", '"@x/a": patch', "---", ""].join("\n"));

		git(dir, "init", "--quiet", "-b", "main");
		git(dir, "config", "commit.gpgsign", "false");
		git(dir, "add", "-A");
		git(dir, "commit", "--quiet", "-m", "base commit");

		const result = await Effect.runPromise(gitListChangesetFilesAtRef(dir, "not-a-real-ref"));
		expect(result).toEqual(new Set());
	});
});
