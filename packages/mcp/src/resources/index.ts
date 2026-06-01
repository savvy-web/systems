/**
 * Register the `silk://catalog` fixed resource plus a single `silk://{+path}`
 * ResourceTemplate (read + list) over the compiled manifest. Resources are
 * stateless readers; per-doc annotations are emitted in list() entries and read
 * contents (no per-URI registration with one template).
 *
 * @packageDocumentation
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";

import { renderCatalogMarkdown } from "./catalog.js";
import { readDocBody } from "./load.js";
import type { Manifest, ManifestEntry } from "./schema.js";

export interface ResourceDeps {
	readonly manifest: Manifest;
	readonly bodies?: Readonly<Record<string, string>>; // test injection; runtime reads from disk
	readonly contentRoot: string;
}

const resourceName = (uri: string): string => `silk_${uri.replace(/[^A-Za-z0-9]/g, "_")}`;

const toSdkAnnotations = (e: ManifestEntry) => ({
	audience: [...e.audience],
	priority: e.priority,
	...(e.lastModified ? { lastModified: e.lastModified } : {}),
});

export function registerAllResources(server: McpServer, deps: ResourceDeps): void {
	const { manifest, bodies, contentRoot } = deps;

	server.registerResource(
		"silk_catalog",
		"silk://catalog",
		{
			title: "Silk resource catalog",
			description:
				"Read this first. Lists every Silk resource grouped by tier with a 'load when' hint. Fetch a doc with resources/read <uri>; search by intent with silk_docs_search.",
			mimeType: "text/markdown",
		},
		async (uri) => ({
			contents: [{ uri: uri.href, mimeType: "text/markdown", text: renderCatalogMarkdown(manifest) }],
		}),
	);

	const byUri = new Map(manifest.entries.map((e) => [e.uri, e]));
	const readBody = (uri: string, relPath: string): string =>
		bodies ? (bodies[uri] ?? "") : readDocBody(contentRoot, relPath);

	server.registerResource(
		"silk_doc",
		new ResourceTemplate("silk://{+path}", {
			list: async () => ({
				resources: manifest.entries
					.filter((e) => e.uri !== "silk://catalog" && e.status !== "deprecated")
					.map((e) => ({
						name: resourceName(e.uri),
						uri: e.uri,
						title: e.title,
						description: e.summary,
						mimeType: "text/markdown",
						annotations: toSdkAnnotations(e),
					})),
			}),
		}),
		{ title: "Silk documentation resource", mimeType: "text/markdown" },
		async (uri, variables) => {
			const relPath = String(variables.path ?? "");
			const entry = byUri.get(uri.href);
			return {
				contents: [
					{
						uri: uri.href,
						mimeType: "text/markdown",
						text: readBody(uri.href, relPath),
						...(entry ? { annotations: toSdkAnnotations(entry) } : {}),
					},
				],
			};
		},
	);
}
