import { describe, expect, it } from "vitest";

import { CATALOG_ENTRIES, renderCatalogMarkdown } from "../../src/resources/catalog.js";
import { RESOURCE_CONTENT } from "../../src/resources/index.js";

describe("resource catalog", () => {
	it("every catalog entry URI resolves to registered content", () => {
		for (const entry of CATALOG_ENTRIES) {
			expect(RESOURCE_CONTENT[entry.uri], `missing content for ${entry.uri}`).toBeTypeOf("string");
		}
	});

	it("renders a markdown catalog grouped by tier with load-when hints", () => {
		const md = renderCatalogMarkdown();
		expect(md).toContain("silk://catalog");
		expect(md).toContain("Standards");
		expect(md).toContain("Packages");
		expect(md).toContain("Guides");
		expect(md).toContain("load when");
		for (const entry of CATALOG_ENTRIES) {
			expect(md).toContain(entry.uri);
		}
	});
});
