import { describe, expect, it } from "vitest";

import { parseMarkdown } from "../../src/changesets/utils/remark-pipeline.js";
import { getBlockSections, getHeadingText, getVersionBlocks } from "../../src/changesets/utils/version-blocks.js";

describe("getVersionBlocks", () => {
	it("extracts a single version block", () => {
		const tree = parseMarkdown("## 1.0.0\n\n### Features\n\n- Added X\n");
		const blocks = getVersionBlocks(tree);
		expect(blocks).toHaveLength(1);
		expect(blocks[0].headingIndex).toBe(0);
		expect(blocks[0].startIndex).toBe(1);
		expect(blocks[0].endIndex).toBe(tree.children.length);
	});

	it("extracts multiple version blocks", () => {
		const tree = parseMarkdown("## 2.0.0\n\n- B\n\n## 1.0.0\n\n- A\n");
		const blocks = getVersionBlocks(tree);
		expect(blocks).toHaveLength(2);
		// First block ends where second begins
		expect(blocks[0].endIndex).toBe(blocks[1].headingIndex);
	});

	it("skips h1 package heading", () => {
		const tree = parseMarkdown("# @savvy-web/changesets\n\n## 1.0.0\n\n- A\n");
		const blocks = getVersionBlocks(tree);
		expect(blocks).toHaveLength(1);
		// The h2 is not at index 0 because h1 comes first
		expect(blocks[0].headingIndex).toBeGreaterThan(0);
	});

	it("returns empty array for empty document", () => {
		const tree = parseMarkdown("");
		const blocks = getVersionBlocks(tree);
		expect(blocks).toHaveLength(0);
	});

	it("returns empty array for document with no h2 headings", () => {
		const tree = parseMarkdown("# Title\n\nSome content\n");
		const blocks = getVersionBlocks(tree);
		expect(blocks).toHaveLength(0);
	});

	it("handles version block with no content after heading", () => {
		const tree = parseMarkdown("## 1.0.0\n\n## 0.9.0\n\n- A\n");
		const blocks = getVersionBlocks(tree);
		expect(blocks).toHaveLength(2);
		// First block has no content nodes
		expect(blocks[0].endIndex - blocks[0].startIndex).toBe(0);
	});

	it("includes all content between h2 headings", () => {
		const md = "## 2.0.0\n\n### Features\n\n- A\n\n### Bug Fixes\n\n- B\n\n## 1.0.0\n\n- C\n";
		const tree = parseMarkdown(md);
		const blocks = getVersionBlocks(tree);
		expect(blocks).toHaveLength(2);
		// First block should contain h3 headings + lists
		const firstBlockChildren = tree.children.slice(blocks[0].startIndex, blocks[0].endIndex);
		expect(firstBlockChildren.length).toBeGreaterThan(2);
	});
});

describe("getBlockSections", () => {
	it("extracts h3 sections from a version block", () => {
		const tree = parseMarkdown("## 1.0.0\n\n### Features\n\n- A\n\n### Bug Fixes\n\n- B\n");
		const blocks = getVersionBlocks(tree);
		const sections = getBlockSections(tree, blocks[0]);
		expect(sections).toHaveLength(2);
		expect(getHeadingText(sections[0].heading)).toBe("Features");
		expect(getHeadingText(sections[1].heading)).toBe("Bug Fixes");
	});

	it("includes content nodes in each section", () => {
		const tree = parseMarkdown("## 1.0.0\n\n### Features\n\n- A\n- B\n");
		const blocks = getVersionBlocks(tree);
		const sections = getBlockSections(tree, blocks[0]);
		expect(sections).toHaveLength(1);
		expect(sections[0].contentNodes.length).toBeGreaterThan(0);
		expect(sections[0].contentNodes[0].type).toBe("list");
	});

	it("returns empty array for version block with no h3 headings", () => {
		const tree = parseMarkdown("## 1.0.0\n\nSome preamble text.\n");
		const blocks = getVersionBlocks(tree);
		const sections = getBlockSections(tree, blocks[0]);
		expect(sections).toHaveLength(0);
	});

	it("ignores preamble content before first h3", () => {
		const tree = parseMarkdown("## 1.0.0\n\nPreamble text.\n\n### Features\n\n- A\n");
		const blocks = getVersionBlocks(tree);
		const sections = getBlockSections(tree, blocks[0]);
		expect(sections).toHaveLength(1);
		// Preamble should not appear in sections
		expect(getHeadingText(sections[0].heading)).toBe("Features");
	});

	it("handles sections in different version blocks independently", () => {
		const md = "## 2.0.0\n\n### Features\n\n- A\n\n## 1.0.0\n\n### Bug Fixes\n\n- B\n";
		const tree = parseMarkdown(md);
		const blocks = getVersionBlocks(tree);
		const sections1 = getBlockSections(tree, blocks[0]);
		const sections2 = getBlockSections(tree, blocks[1]);
		expect(sections1).toHaveLength(1);
		expect(getHeadingText(sections1[0].heading)).toBe("Features");
		expect(sections2).toHaveLength(1);
		expect(getHeadingText(sections2[0].heading)).toBe("Bug Fixes");
	});
});

describe("getHeadingText", () => {
	it("returns plain text of a heading", () => {
		const tree = parseMarkdown("### Features\n");
		const heading = tree.children[0];
		expect(heading.type).toBe("heading");
		if (heading.type === "heading") {
			expect(getHeadingText(heading)).toBe("Features");
		}
	});
});
