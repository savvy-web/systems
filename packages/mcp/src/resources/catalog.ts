/**
 * The resource catalog model: the list of resources grouped by tier, each with
 * a "load when" hint, plus the renderer for the `silk://catalog` resource.
 *
 * @packageDocumentation
 */

/** One catalog entry: a resource URI, its title, tier, and a load-when hint. */
export interface CatalogEntry {
	readonly uri: string;
	readonly title: string;
	readonly tier: "Standards" | "Packages" | "Guides";
	readonly loadWhen: string;
}

/** The catalog — the agent's mandated first read. */
export const CATALOG_ENTRIES: ReadonlyArray<CatalogEntry> = [
	{
		uri: "silk://standards/changesets",
		title: "Silk standard: changesets",
		tier: "Standards",
		loadWhen: "writing or reviewing a changeset, or deciding a version bump",
	},
	{
		uri: "silk://packages/silk-effects/",
		title: "@savvy-web/silk-effects overview",
		tier: "Packages",
		loadWhen: "using @savvy-web/silk-effects and unsure which service or layer applies",
	},
	{
		uri: "silk://packages/silk-effects/managed-section",
		title: "silk-effects: ManagedSection",
		tier: "Packages",
		loadWhen: "editing a tool-managed block inside a shared config file",
	},
	{
		uri: "silk://guides/llm-friendly-json-schemas",
		title: "Guide: LLM-friendly JSON Schemas for tool outputs",
		tier: "Guides",
		loadWhen: "designing an MCP tool output schema or a GitHub Action's outputs",
	},
];

const TIERS: ReadonlyArray<CatalogEntry["tier"]> = ["Standards", "Packages", "Guides"];

/** Render the catalog as grouped markdown with load-when hints. */
export const renderCatalogMarkdown = (): string => {
	const lines: string[] = ["# silk://catalog", "", "Read this first, then fetch only the resources you need.", ""];
	for (const tier of TIERS) {
		lines.push(`## ${tier}`, "");
		for (const entry of CATALOG_ENTRIES.filter((e) => e.tier === tier)) {
			lines.push(`- \`${entry.uri}\` — ${entry.title}. load when: ${entry.loadWhen}.`);
		}
		lines.push("");
	}
	return lines.join("\n");
};
