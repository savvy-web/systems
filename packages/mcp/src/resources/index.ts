/**
 * Registers the catalog and every content resource against the MCP server.
 *
 * @packageDocumentation
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import { CATALOG_ENTRIES, renderCatalogMarkdown } from "./catalog.js";
import {
	GUIDES_LLM_JSON_SCHEMAS_MD,
	PACKAGES_SILK_EFFECTS_INDEX_MD,
	PACKAGES_SILK_EFFECTS_MANAGED_SECTION_MD,
	STANDARDS_CHANGESETS_MD,
} from "./content.js";

/** Map of resource URI to markdown content, keyed by the catalog entries. */
export const RESOURCE_CONTENT: Readonly<Record<string, string>> = {
	"silk://standards/changesets": STANDARDS_CHANGESETS_MD,
	"silk://packages/silk-effects/": PACKAGES_SILK_EFFECTS_INDEX_MD,
	"silk://packages/silk-effects/managed-section": PACKAGES_SILK_EFFECTS_MANAGED_SECTION_MD,
	"silk://guides/llm-friendly-json-schemas": GUIDES_LLM_JSON_SCHEMAS_MD,
};

/** Stable, client-safe resource name from a URI. */
const resourceName = (uri: string): string => `silk_${uri.replace(/[^A-Za-z0-9]/g, "_")}`;

/** Register the catalog plus every content resource. */
export function registerAllResources(server: McpServer): void {
	server.registerResource(
		"silk_catalog",
		"silk://catalog",
		{
			title: "Silk resource catalog",
			description:
				"Read this first. Lists every Silk resource grouped by tier (Standards, Packages, Guides), each with a 'load when' hint, so you fetch only what a task needs.",
			mimeType: "text/markdown",
		},
		async (uri) => ({
			contents: [{ uri: uri.href, mimeType: "text/markdown", text: renderCatalogMarkdown() }],
		}),
	);

	for (const entry of CATALOG_ENTRIES) {
		const text = RESOURCE_CONTENT[entry.uri] ?? "";
		server.registerResource(
			resourceName(entry.uri),
			entry.uri,
			{
				title: entry.title,
				description: `Load when: ${entry.loadWhen}.`,
				mimeType: "text/markdown",
			},
			async (uri) => ({
				contents: [{ uri: uri.href, mimeType: "text/markdown", text }],
			}),
		);
	}
}
