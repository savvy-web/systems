import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "@effect/vitest";
import { Git, NotARepositoryError } from "@effected/git";
import { Effect } from "effect";
import { writeCache } from "../../../../src/commitlint/hook/diagnostics/cache.js";
import {
	readOpenIssuesFromCache,
	resolveIssuesCachePath,
} from "../../../../src/commitlint/hook/diagnostics/open-issues.js";

let dir: string;

beforeEach(() => {
	dir = mkdtempSync(join(tmpdir(), "savvy-issues-"));
});

afterEach(() => {
	rmSync(dir, { recursive: true, force: true });
});

describe("readOpenIssuesFromCache", () => {
	it.effect("returns null when cache file is missing", () =>
		Effect.gen(function* () {
			const out = yield* readOpenIssuesFromCache(join(dir, "issues.json"), 600);
			expect(out).toBeNull();
		}),
	);

	it.effect("returns issues when cache is fresh", () =>
		Effect.gen(function* () {
			const path = join(dir, "issues.json");
			yield* writeCache(path, [
				{ number: 42, title: "Improve commit hooks" },
				{ number: 51, title: "Document signing setup" },
			]);
			const out = yield* readOpenIssuesFromCache(path, 600);
			expect(out).toEqual([
				{ number: 42, title: "Improve commit hooks" },
				{ number: 51, title: "Document signing setup" },
			]);
		}),
	);
});

describe("resolveIssuesCachePath", () => {
	it.effect("uses the project dir when one is given", () =>
		Effect.gen(function* () {
			const out = yield* resolveIssuesCachePath({ cwd: "/repo/packages/pkg", projectDir: "/project" });
			expect(out).toBe("/project/.claude/cache/issues.json");
		}).pipe(Effect.provide(Git.layerTest({ repoRoot: () => Effect.die("repoRoot must not be consulted") }))),
	);

	it.effect("falls back to the git repository root, not a nested cwd", () =>
		Effect.gen(function* () {
			const out = yield* resolveIssuesCachePath({ cwd: "/repo/packages/pkg", projectDir: undefined });
			expect(out).toBe("/repo/.claude/cache/issues.json");
		}).pipe(Effect.provide(Git.layerTest({ repoRoot: () => Effect.succeed("/repo") }))),
	);

	it.effect("falls back to cwd outside any repository", () =>
		Effect.gen(function* () {
			const out = yield* resolveIssuesCachePath({ cwd: "/loose/dir", projectDir: "" });
			expect(out).toBe("/loose/dir/.claude/cache/issues.json");
		}).pipe(Effect.provide(Git.layerTest({ repoRoot: (cwd) => Effect.fail(new NotARepositoryError({ cwd })) }))),
	);
});
