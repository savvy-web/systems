// packages/tsdown-plugins/src/meta/scrub-declaration-maps.ts
import { readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { decode, encode } from "@jridgewell/sourcemap-codec";

/**
 * Drop every source-less segment (a generated position with no original position) from a
 * declaration map, in place. Returns the number of segments removed.
 *
 * @remarks
 * rolldown 1.2.15+ writes such segments for declarations TypeScript synthesizes with no source
 * position — the `declare const X_base` hoisted for a class whose heritage clause is a call
 * expression (Effect's `Schema.Class`/`Data.TaggedError`, any mixin factory). API Extractor's
 * `SourceMapper` resolves a source-less mapping item to the `.d.ts`'s own directory and then
 * `readFile`s it, so the meta pass dies with `EISDIR` (savvy-web/systems#817; upstream
 * microsoft/rushstack#6156 / PR #6157, unreleased). Segments with no source carry no location a
 * consumer can use, so removing them is lossless for every reader.
 *
 * @internal
 */
export function scrubSourcelessMappings(mapPath: string): number {
	const raw = JSON.parse(readFileSync(mapPath, "utf8")) as { mappings: string };
	const lines = decode(raw.mappings);
	let removed = 0;
	const scrubbed = lines.map((segments) =>
		segments.filter((segment) => {
			if (segment.length === 1) {
				removed += 1;
				return false;
			}
			return true;
		}),
	);
	if (removed > 0) writeFileSync(mapPath, `${JSON.stringify({ ...raw, mappings: encode(scrubbed) })}\n`, "utf8");
	return removed;
}

/**
 * Scrub every `.d.ts.map`/`.d.cts.map`/`.d.mts.map` under `dir` (recursively). Returns the total
 * number of segments removed. Missing dir -> 0.
 *
 * @internal
 */
export function scrubDeclarationMapsUnder(dir: string): number {
	let removed = 0;
	let entries: string[];
	try {
		entries = readdirSync(dir);
	} catch {
		return 0;
	}
	for (const name of entries) {
		const p = join(dir, name);
		if (statSync(p).isDirectory()) removed += scrubDeclarationMapsUnder(p);
		else if (/\.d\.[cm]?ts\.map$/.test(name)) removed += scrubSourcelessMappings(p);
	}
	return removed;
}
