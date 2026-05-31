import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Effect } from "effect";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { readCache, writeCache } from "../../../../src/commitlint/hook/diagnostics/cache.js";

let dir: string;

beforeEach(() => {
	dir = mkdtempSync(join(tmpdir(), "savvy-cache-"));
});

afterEach(() => {
	rmSync(dir, { recursive: true, force: true });
});

describe("cache", () => {
	it("returns null for missing file", async () => {
		const result = await Effect.runPromise(readCache<{ x: number }>(join(dir, "missing.json"), 60));
		expect(result).toBeNull();
	});

	it("writes then reads when fresh", async () => {
		const path = join(dir, "v.json");
		await Effect.runPromise(writeCache(path, { x: 1 }));
		const result = await Effect.runPromise(readCache<{ x: number }>(path, 60));
		expect(result).toEqual({ x: 1 });
	});

	it("returns null when stale (TTL exceeded)", async () => {
		const path = join(dir, "v.json");
		await Effect.runPromise(writeCache(path, { x: 1 }, new Date(Date.now() - 120_000)));
		const result = await Effect.runPromise(readCache<{ x: number }>(path, 60));
		expect(result).toBeNull();
	});

	it("creates parent directories", async () => {
		const path = join(dir, "a/b/c/v.json");
		await Effect.runPromise(writeCache(path, { x: 2 }));
		const result = await Effect.runPromise(readCache<{ x: number }>(path, 60));
		expect(result).toEqual({ x: 2 });
	});
});
