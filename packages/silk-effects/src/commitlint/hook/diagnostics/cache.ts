/**
 * JSON file cache with TTL. Writes are atomic-ish (mkdir -p, write,
 * rename). Reads return null on any error or staleness — callers
 * recompute silently.
 *
 * @internal
 */
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { Effect } from "effect";

interface CacheEnvelope<T> {
	cachedAt: string;
	data: T;
}

export function readCache<T>(path: string, ttlSeconds: number): Effect.Effect<T | null> {
	return Effect.tryPromise(async () => {
		const raw = await readFile(path, "utf8");
		const env = JSON.parse(raw) as CacheEnvelope<T>;
		const cachedMs = Date.parse(env.cachedAt);
		if (Number.isNaN(cachedMs)) return null;
		if (Date.now() - cachedMs > ttlSeconds * 1000) return null;
		return env.data;
	}).pipe(Effect.orElseSucceed(() => null));
}

export function writeCache<T>(path: string, data: T, when: Date = new Date()): Effect.Effect<void> {
	return Effect.tryPromise(async () => {
		await mkdir(dirname(path), { recursive: true });
		const env: CacheEnvelope<T> = { cachedAt: when.toISOString(), data };
		const tmp = `${path}.tmp`;
		await writeFile(tmp, JSON.stringify(env), "utf8");
		await rename(tmp, path);
	}).pipe(Effect.orElseSucceed(() => undefined));
}
