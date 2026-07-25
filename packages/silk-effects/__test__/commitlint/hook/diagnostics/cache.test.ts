import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import { readCache, writeCache } from "../../../../src/commitlint/hook/diagnostics/cache.js";

let dir: string;

beforeEach(() => {
	dir = mkdtempSync(join(tmpdir(), "savvy-cache-"));
});

afterEach(() => {
	rmSync(dir, { recursive: true, force: true });
});

describe("cache", () => {
	it.effect("returns null for missing file", () =>
		Effect.gen(function* () {
			const result = yield* readCache<{ x: number }>(join(dir, "missing.json"), 60);
			expect(result).toBeNull();
		}),
	);

	it.effect("writes then reads when fresh", () =>
		Effect.gen(function* () {
			const path = join(dir, "v.json");
			yield* writeCache(path, { x: 1 });
			const result = yield* readCache<{ x: number }>(path, 60);
			expect(result).toEqual({ x: 1 });
		}),
	);

	it.effect("returns null when stale (TTL exceeded)", () =>
		Effect.gen(function* () {
			const path = join(dir, "v.json");
			yield* writeCache(path, { x: 1 }, new Date(Date.now() - 120_000));
			const result = yield* readCache<{ x: number }>(path, 60);
			expect(result).toBeNull();
		}),
	);

	it.effect("creates parent directories", () =>
		Effect.gen(function* () {
			const path = join(dir, "a/b/c/v.json");
			yield* writeCache(path, { x: 2 });
			const result = yield* readCache<{ x: number }>(path, 60);
			expect(result).toEqual({ x: 2 });
		}),
	);
});
