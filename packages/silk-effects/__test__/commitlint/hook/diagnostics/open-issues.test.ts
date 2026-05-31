import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Effect } from "effect";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
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
	it("returns null when cache file is missing", async () => {
		const out = await Effect.runPromise(readOpenIssuesFromCache(join(dir, "issues.json"), 600));
		expect(out).toBeNull();
	});

	it("returns issues when cache is fresh", async () => {
		const path = join(dir, "issues.json");
		await Effect.runPromise(
			writeCache(path, [
				{ number: 42, title: "Improve commit hooks" },
				{ number: 51, title: "Document signing setup" },
			]),
		);
		const out = await Effect.runPromise(readOpenIssuesFromCache(path, 600));
		expect(out).toEqual([
			{ number: 42, title: "Improve commit hooks" },
			{ number: 51, title: "Document signing setup" },
		]);
	});
});
