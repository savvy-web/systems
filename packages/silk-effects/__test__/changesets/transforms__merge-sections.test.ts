import { Mdast } from "@effected/markdown";
import { describe, expect, it } from "vitest";
import { mergeSections } from "../../src/changesets/transforms/merge-sections.js";
import type { RootChild } from "../../src/changesets/utils/blocks.js";
import { getBlockSections, getHeadingText, getVersionBlocks } from "../../src/changesets/utils/blocks.js";
import { emitKitMarkdown, parseKitMarkdown } from "../../src/changesets/utils/markdown-emit.js";

const transform = (md: string) => emitKitMarkdown(mergeSections(parseKitMarkdown(md)));

/** Flatten the list items of a section's content nodes to their text. */
function itemTexts(nodes: ReadonlyArray<RootChild>): string[] {
	return nodes.flatMap((node) => (node.type === "list" ? node.children.map((item) => Mdast.toText(item)) : []));
}

/** The kit emitter may use `*` or `-` bullets; match either. */
function containsItem(result: string, text: string): boolean {
	return result.includes(`* ${text}`) || result.includes(`- ${text}`);
}

describe("merge-sections", () => {
	it("is a no-op when no duplicate headings exist", () => {
		const md = "## 1.0.0\n\n### Features\n\n- A\n\n### Bug Fixes\n\n- B\n";
		const result = transform(md);
		expect(result).toContain("### Features");
		expect(result).toContain("### Bug Fixes");
		expect(containsItem(result, "A")).toBe(true);
		expect(containsItem(result, "B")).toBe(true);
	});

	it("merges two duplicate Features sections", () => {
		const md = "## 1.0.0\n\n### Features\n\n- A\n\n### Features\n\n- B\n";
		const result = transform(md);
		const featureCount = (result.match(/### Features/g) || []).length;
		expect(featureCount).toBe(1);
		expect(containsItem(result, "A")).toBe(true);
		expect(containsItem(result, "B")).toBe(true);
	});

	it("merges three duplicate sections", () => {
		const md = "## 1.0.0\n\n### Features\n\n- A\n\n### Features\n\n- B\n\n### Features\n\n- C\n";
		const result = transform(md);
		const featureCount = (result.match(/### Features/g) || []).length;
		expect(featureCount).toBe(1);
		expect(containsItem(result, "A")).toBe(true);
		expect(containsItem(result, "B")).toBe(true);
		expect(containsItem(result, "C")).toBe(true);
	});

	it("merges duplicate sections in different version blocks independently", () => {
		const md =
			"## 2.0.0\n\n### Features\n\n- A\n\n### Features\n\n- B\n\n## 1.0.0\n\n### Bug Fixes\n\n- C\n\n### Bug Fixes\n\n- D\n";
		const result = transform(md);
		const featureCount = (result.match(/### Features/g) || []).length;
		const bugFixCount = (result.match(/### Bug Fixes/g) || []).length;
		expect(featureCount).toBe(1);
		expect(bugFixCount).toBe(1);
		expect(containsItem(result, "A")).toBe(true);
		expect(containsItem(result, "B")).toBe(true);
		expect(containsItem(result, "C")).toBe(true);
		expect(containsItem(result, "D")).toBe(true);
	});

	it("handles mixed duplicates and unique sections", () => {
		const md = "## 1.0.0\n\n### Features\n\n- A\n\n### Bug Fixes\n\n- B\n\n### Features\n\n- C\n";
		const result = transform(md);
		const featureCount = (result.match(/### Features/g) || []).length;
		const bugFixCount = (result.match(/### Bug Fixes/g) || []).length;
		expect(featureCount).toBe(1);
		expect(bugFixCount).toBe(1);
		expect(containsItem(result, "A")).toBe(true);
		expect(containsItem(result, "B")).toBe(true);
		expect(containsItem(result, "C")).toBe(true);
	});

	it("preserves content order within merged sections", () => {
		const md = "## 1.0.0\n\n### Features\n\n- First\n\n### Features\n\n- Second\n";
		const tree = mergeSections(parseKitMarkdown(md));

		const blocks = getVersionBlocks(tree.children);
		const sections = getBlockSections(tree.children, blocks[0]);
		expect(sections).toHaveLength(1);
		expect(getHeadingText(sections[0].heading)).toBe("Features");
		expect(itemTexts(sections[0].contentNodes)).toEqual(["First", "Second"]);
	});

	it("keeps every item under its own heading when duplicates interleave", () => {
		const md =
			"## 1.0.0\n\n### Features\n\n- f1\n\n### Bug Fixes\n\n- b1\n\n### Features\n\n- f2\n\n### Bug Fixes\n\n- b2\n";
		const tree = mergeSections(parseKitMarkdown(md));

		const blocks = getVersionBlocks(tree.children);
		const sections = getBlockSections(tree.children, blocks[0]);
		expect(sections.map((s) => getHeadingText(s.heading))).toEqual(["Features", "Bug Fixes"]);
		expect(itemTexts(sections[0].contentNodes)).toEqual(["f1", "f2"]);
		expect(itemTexts(sections[1].contentNodes)).toEqual(["b1", "b2"]);
	});

	it("leaves a preceding version block untouched when a later block merges", () => {
		const md = "## 2.0.0\n\n### Features\n\n- A\n\n### Features\n\n- B\n\n## 1.0.0\n\n### Features\n\n- C\n";
		const result = transform(md);
		expect(result).toBe("## 2.0.0\n\n### Features\n\n- A\n\n* B\n\n## 1.0.0\n\n### Features\n\n- C\n");
	});

	it("is a no-op for a single section", () => {
		const md = "## 1.0.0\n\n### Features\n\n- A\n";
		const result = transform(md);
		expect(result).toContain("### Features");
		expect(containsItem(result, "A")).toBe(true);
	});

	it("is a no-op for version block with no sections", () => {
		const md = "## 1.0.0\n\nSome text.\n";
		const result = transform(md);
		expect(result).toContain("## 1.0.0");
		expect(result).toContain("Some text.");
	});

	it("handles empty document gracefully", () => {
		const result = transform("");
		expect(result.trim()).toBe("");
	});
});
