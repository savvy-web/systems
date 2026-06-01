/**
 * Render the `silk://catalog` resource from the manifest: grouped by tier, each
 * line a URI + summary "load when" hint + provenance marker.
 *
 * @packageDocumentation
 */

import type { Manifest, ManifestEntry } from "./schema.js";

const TIER_HEADINGS: ReadonlyArray<[ManifestEntry["tier"], string]> = [
	["standards", "Standards"],
	["packages", "Packages"],
	["guides", "Guides"],
];

export function renderCatalogMarkdown(manifest: Manifest): string {
	const lines: string[] = [
		"# silk://catalog",
		"",
		"Read this first to orient. To fetch a doc, call `resources/read` with its `silk://` URI.",
		"To search by intent, use the `silk_docs_search` tool.",
		"",
	];
	for (const [tier, heading] of TIER_HEADINGS) {
		const entries = manifest.entries.filter((e) => e.tier === tier && e.status !== "deprecated");
		if (entries.length === 0) continue;
		lines.push(`## ${heading}`, "");
		for (const e of entries) {
			const gen = e.source === "generated" ? " (generated)" : "";
			lines.push(`- \`${e.uri}\`${gen} — ${e.title}. load when: ${e.summary}`);
		}
		lines.push("");
	}
	return lines.join("\n");
}
