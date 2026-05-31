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

describe("changeset shims", () => {
	it("changelog default export implements ChangelogFunctions", async () => {
		const mod = await import("../src/changesets/changelog.js");
		expect(typeof mod.default.getReleaseLine).toBe("function");
		expect(typeof mod.default.getDependencyReleaseLine).toBe("function");
	});

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

	it("remark presets are non-empty arrays of plugins", async () => {
		const mod = await import("../src/changesets/remark.js");
		// SilkChangesetPreset bundles the five lint rules; the transform preset
		// bundles the seven transform plugins. Each entry is a unified plugin.
		expect(Array.isArray(mod.SilkChangesetPreset)).toBe(true);
		expect(mod.SilkChangesetPreset.length).toBe(5);
		for (const plugin of mod.SilkChangesetPreset) {
			expect(typeof plugin).toBe("function");
		}
		expect(Array.isArray(mod.SilkChangesetTransformPreset)).toBe(true);
		expect(mod.SilkChangesetTransformPreset.length).toBe(7);
		for (const plugin of mod.SilkChangesetTransformPreset) {
			expect(typeof plugin).toBe("function");
		}
	});

	it("remark exports all transform plugins as unified plugin functions", async () => {
		const mod = await import("../src/changesets/remark.js");
		expect(typeof mod.AggregateDependencyTablesPlugin).toBe("function");
		expect(typeof mod.ContributorFootnotesPlugin).toBe("function");
		expect(typeof mod.DeduplicateItemsPlugin).toBe("function");
		expect(typeof mod.IssueLinkRefsPlugin).toBe("function");
		expect(typeof mod.MergeSectionsPlugin).toBe("function");
		expect(typeof mod.NormalizeFormatPlugin).toBe("function");
		expect(typeof mod.ReorderSectionsPlugin).toBe("function");
	});

	it("remark exports all lint rules as unified plugin functions", async () => {
		const mod = await import("../src/changesets/remark.js");
		expect(typeof mod.ContentStructureRule).toBe("function");
		expect(typeof mod.DependencyTableFormatRule).toBe("function");
		expect(typeof mod.HeadingHierarchyRule).toBe("function");
		expect(typeof mod.RequiredSectionsRule).toBe("function");
		expect(typeof mod.UncategorizedContentRule).toBe("function");
	});

	it("root export exposes the class API", async () => {
		const mod = await import("../src/changesets/index.js");
		expect(mod.ChangesetLinter).toBeDefined();
		expect(mod.ChangelogTransformer).toBeDefined();
		expect(mod.Categories).toBeDefined();
		expect(mod.Changelog).toBeDefined();
		expect(mod.DependencyTable).toBeDefined();
	});
});
