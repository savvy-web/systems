import { describe, expect, it } from "vitest";
import type { RawDoc } from "../../scripts/compile.js";
import { compileCorpus } from "../../scripts/compile.js";

const registry = { changeset: ["changesets"], lint: ["biome"] };

const baseFrontMatter = {
	id: "standards/changeset-discipline",
	title: "Changeset discipline",
	summary: "When a changeset is required.",
	tier: "standards",
	source: "hand",
	tags: ["changeset"],
	related: [],
};

const doc = (over: Partial<RawDoc>): RawDoc => ({
	relPath: "standards/changeset-discipline.md",
	frontMatter: baseFrontMatter,
	body: "# Changeset discipline\n\nRule: every user-facing change ships a changeset.",
	lastModified: "2026-05-31T00:00:00Z",
	...over,
});

describe("compileCorpus", () => {
	it("emits a manifest entry with the derived uri and canonical tags", () => {
		const out = compileCorpus([doc({})], registry, { bodyBudgetBytes: { standards: 4000 } });
		expect(out.manifest.entries[0].uri).toBe("silk://standards/changeset-discipline");
		expect(out.manifest.entries[0].tags).toEqual(["changeset"]);
		expect(out.errors).toEqual([]);
	});

	it("errors when id does not match the file's tier directory", () => {
		const out = compileCorpus([doc({ relPath: "guides/changeset-discipline.md" })], registry, {});
		expect(out.errors.join("\n")).toMatch(/tier .* does not match directory/);
	});

	it("errors on a duplicate id", () => {
		const out = compileCorpus([doc({}), doc({ relPath: "standards/dup.md" })], registry, {});
		expect(out.errors.join("\n")).toMatch(/duplicate id/);
	});

	it("errors on a dangling related reference", () => {
		const out = compileCorpus(
			[doc({ frontMatter: { ...baseFrontMatter, related: ["standards/ghost"] } })],
			registry,
			{},
		);
		expect(out.errors.join("\n")).toMatch(/dangling related: standards\/ghost/);
	});

	it("errors on an unknown tag", () => {
		const out = compileCorpus([doc({ frontMatter: { ...baseFrontMatter, tags: ["nope"] } })], registry, {});
		expect(out.errors.join("\n")).toMatch(/unknown tag: nope/);
	});

	it("errors on a dead workflow-* name in the body", () => {
		const out = compileCorpus([doc({ body: "see workflow-release-action" })], registry, {});
		expect(out.errors.join("\n")).toMatch(/dead identifier: workflow-release-action/);
	});

	it("warns when body exceeds the tier budget", () => {
		const out = compileCorpus([doc({ body: "x".repeat(5000) })], registry, { bodyBudgetBytes: { standards: 4000 } });
		expect(out.warnings.join("\n")).toMatch(/body 5000 bytes exceeds budget/);
	});

	it("injects a provenance marker into generated docs", () => {
		const out = compileCorpus([doc({ frontMatter: { ...baseFrontMatter, source: "generated" } })], registry, {});
		expect(out.bodies["silk://standards/changeset-discipline"]).toMatch(/Generated from the API Extractor model/);
	});

	it("does not warn on body budget for generated docs", () => {
		const out = compileCorpus(
			[doc({ body: "x".repeat(20000), frontMatter: { ...baseFrontMatter, source: "generated" } })],
			registry,
			{ bodyBudgetBytes: { standards: 4000 } },
		);
		expect(out.warnings.join("\n")).not.toMatch(/exceeds budget/);
	});
});
