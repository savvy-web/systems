import { describe, expect, it } from "vitest";

/**
 * A markdownlint rule object has a `names` string array and an executable
 * `function` field (the micromark-token rule body). Asserting both protects
 * drop-in compatibility with markdownlint-cli2 customRules.
 */
function expectMarkdownlintRule(rule: unknown): void {
	expect(rule).toBeTypeOf("object");
	const r = rule as { names?: unknown; function?: unknown };
	expect(Array.isArray(r.names)).toBe(true);
	expect((r.names as unknown[]).length).toBeGreaterThan(0);
	expect(typeof r.function).toBe("function");
}

describe("changesets shims", () => {
	it("markdownlint default export is the non-empty rules array (SilkChangesetsRules)", async () => {
		const mod = await import("../src/changesets/markdownlint.js");
		// The original @savvy-web/changesets/markdownlint default-exported
		// SilkChangesetsRules, an array of markdownlint Rule objects.
		expect(Array.isArray(mod.default)).toBe(true);
		expect(mod.default.length).toBe(5);
		for (const rule of mod.default) {
			expectMarkdownlintRule(rule);
		}
	});

	it("markdownlint named exports are markdownlint Rule objects", async () => {
		const mod = await import("../src/changesets/markdownlint.js");
		// The original named exports (NOT Markdownlint-prefixed) from the original module.
		expectMarkdownlintRule(mod.HeadingHierarchyRule);
		expectMarkdownlintRule(mod.RequiredSectionsRule);
		expectMarkdownlintRule(mod.ContentStructureRule);
		expectMarkdownlintRule(mod.UncategorizedContentRule);
		expectMarkdownlintRule(mod.DependencyTableFormatRule);
	});
});
