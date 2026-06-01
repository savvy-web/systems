/**
 * Controlled tag vocabulary: canonical tags + allowed aliases. Authors keep
 * ergonomic synonyms in source; the compile step canonicalizes what lands in
 * the index, and rejects tags absent from the registry.
 *
 * @packageDocumentation
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/** Map of canonical tag -> allowed aliases. */
export type TagRegistry = Readonly<Record<string, ReadonlyArray<string>>>;

/** Load the checked-in registry from the content directory (source layout). */
export function loadTagRegistry(): TagRegistry {
	const here = dirname(fileURLToPath(import.meta.url));
	const path = join(here, "content", "tags.json");
	return JSON.parse(readFileSync(path, "utf8")) as TagRegistry;
}

/** Map each tag to its canonical form; throw on an unknown tag. */
export function canonicalizeTags(tags: ReadonlyArray<string>, registry: TagRegistry): string[] {
	const aliasToCanonical = new Map<string, string>();
	for (const [canonical, aliases] of Object.entries(registry)) {
		aliasToCanonical.set(canonical, canonical);
		for (const alias of aliases) aliasToCanonical.set(alias, canonical);
	}
	return tags.map((tag) => {
		const canonical = aliasToCanonical.get(tag);
		if (canonical === undefined) throw new Error(`unknown tag: ${tag} (add it to content/tags.json)`);
		return canonical;
	});
}
