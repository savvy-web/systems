import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import { writeCache } from "../../../../src/commitlint/hook/diagnostics/cache.js";
import { readOpenIssuesFromCache } from "../../../../src/commitlint/hook/diagnostics/open-issues.js";

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
