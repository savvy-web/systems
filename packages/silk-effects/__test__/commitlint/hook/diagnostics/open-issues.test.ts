import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "@effect/vitest";
import { ScriptedSpawner } from "@effected/commands";
import { Git, NotARepositoryError } from "@effected/git";
import { Effect } from "effect";
import { writeCache } from "../../../../src/commitlint/hook/diagnostics/cache.js";
import {
	fetchAndCacheOpenIssues,
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

describe("fetchAndCacheOpenIssues", () => {
	const ISSUES = '[{"number":42,"title":"Improve commit hooks"}]';
	const gh = (
		list: { stdout?: string; exit?: number },
		repo: { stdout?: string; exit?: number } = { stdout: "o/n\n" },
	) => ScriptedSpawner.make((_command, args) => (args[0] === "repo" ? repo : list));

	it.effect("decodes the issue list and writes it to the cache", () => {
		const spawner = gh({ stdout: ISSUES });
		const path = join(dir, "issues.json");
		return Effect.gen(function* () {
			const out = yield* fetchAndCacheOpenIssues(path);
			expect(out).toEqual([{ number: 42, title: "Improve commit hooks" }]);
			expect(yield* readOpenIssuesFromCache(path, 600)).toEqual(out);
			expect(spawner.spawns[1]?.args).toContain("o/n");
		}).pipe(Effect.provide(spawner.layer));
	});

	it.effect("returns null when gh is missing", () =>
		fetchAndCacheOpenIssues(join(dir, "issues.json")).pipe(
			Effect.map((out) => expect(out).toBeNull()),
			Effect.provide(ScriptedSpawner.make((command) => ScriptedSpawner.notFound(command)).layer),
		),
	);

	it.effect("returns null when the repo lookup prints nothing", () =>
		fetchAndCacheOpenIssues(join(dir, "issues.json")).pipe(
			Effect.map((out) => expect(out).toBeNull()),
			Effect.provide(gh({ stdout: ISSUES }, { stdout: "\n" }).layer),
		),
	);

	it.effect("returns null and caches nothing when gh exits non-zero", () => {
		const path = join(dir, "issues.json");
		return Effect.gen(function* () {
			expect(yield* fetchAndCacheOpenIssues(path)).toBeNull();
			expect(yield* readOpenIssuesFromCache(path, 600)).toBeNull();
		}).pipe(Effect.provide(gh({ stdout: ISSUES, exit: 1 }).layer));
	});

	it.effect("returns null and caches nothing for JSON that is not an issue list", () => {
		const path = join(dir, "issues.json");
		return Effect.gen(function* () {
			expect(yield* fetchAndCacheOpenIssues(path)).toBeNull();
			expect(yield* readOpenIssuesFromCache(path, 600)).toBeNull();
		}).pipe(Effect.provide(gh({ stdout: '{"message":"rate limited"}' }).layer));
	});

	it.effect("returns null and caches nothing for an issue with a wrongly typed field", () => {
		const path = join(dir, "issues.json");
		return Effect.gen(function* () {
			expect(yield* fetchAndCacheOpenIssues(path)).toBeNull();
			expect(yield* readOpenIssuesFromCache(path, 600)).toBeNull();
		}).pipe(Effect.provide(gh({ stdout: '[{"number":"42","title":"Improve commit hooks"}]' }).layer));
	});

	it.effect("returns null for output that is not JSON", () =>
		fetchAndCacheOpenIssues(join(dir, "issues.json")).pipe(
			Effect.map((out) => expect(out).toBeNull()),
			Effect.provide(gh({ stdout: "not json" }).layer),
		),
	);
});
