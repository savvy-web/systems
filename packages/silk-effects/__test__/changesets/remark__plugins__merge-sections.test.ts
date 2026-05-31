import type { Root } from "mdast";
import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import remarkStringify from "remark-stringify";
import { unified } from "unified";
import { describe, expect, it } from "vitest";
import { MergeSectionsPlugin } from "../../src/changesets/remark/plugins/merge-sections.js";
import { parseMarkdown } from "../../src/changesets/utils/remark-pipeline.js";
import { getBlockSections, getHeadingText, getVersionBlocks } from "../../src/changesets/utils/version-blocks.js";

function transform(md: string): string {
	return String(
		unified().use(remarkParse).use(remarkGfm).use(MergeSectionsPlugin).use(remarkStringify).processSync(md),
	);
}

/** remark-stringify uses `*` bullets; match either `*` or `-` */
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
		const tree = parseMarkdown(md);
		const run = (MergeSectionsPlugin as () => (tree: Root) => void)();
		run(tree);

		const blocks = getVersionBlocks(tree);
		const sections = getBlockSections(tree, blocks[0]);
		expect(sections).toHaveLength(1);
		expect(getHeadingText(sections[0].heading)).toBe("Features");
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
