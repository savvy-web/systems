import type { Root } from "mdast";
import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import remarkStringify from "remark-stringify";
import { unified } from "unified";
import { describe, expect, it } from "vitest";
import { NormalizeFormatPlugin } from "../../src/changesets/remark/plugins/normalize-format.js";
import { parseMarkdown } from "../../src/changesets/utils/remark-pipeline.js";

function transform(md: string): string {
	return String(
		unified().use(remarkParse).use(remarkGfm).use(NormalizeFormatPlugin).use(remarkStringify).processSync(md),
	);
}

describe("normalize-format", () => {
	it("is a no-op for clean document", () => {
		const md = "## 1.0.0\n\n### Features\n\n- A\n\n### Bug Fixes\n\n- B\n";
		const result = transform(md);
		expect(result).toContain("### Features");
		expect(result).toContain("### Bug Fixes");
	});

	it("removes empty section (h3 followed immediately by h3)", () => {
		const md = "## 1.0.0\n\n### Features\n\n### Bug Fixes\n\n- B\n";
		const result = transform(md);
		expect(result).not.toContain("### Features");
		expect(result).toContain("### Bug Fixes");
	});

	it("removes empty section (h3 at end of block)", () => {
		const md = "## 1.0.0\n\n### Features\n\n- A\n\n### Bug Fixes\n";
		const result = transform(md);
		expect(result).toContain("### Features");
		expect(result).not.toContain("### Bug Fixes");
	});

	it("removes multiple empty sections", () => {
		const md = "## 1.0.0\n\n### Features\n\n### Bug Fixes\n\n### Performance\n\n- P\n";
		const result = transform(md);
		expect(result).not.toContain("### Features");
		expect(result).not.toContain("### Bug Fixes");
		expect(result).toContain("### Performance");
	});

	it("preserves non-empty sections", () => {
		const md = "## 1.0.0\n\n### Features\n\n- A\n\n### Bug Fixes\n\n- B\n";
		const result = transform(md);
		expect(result).toContain("### Features");
		expect(result).toContain("### Bug Fixes");
		expect(result).toContain("A");
		expect(result).toContain("B");
	});

	it("removes empty list nodes", () => {
		const tree = parseMarkdown("## 1.0.0\n\n### Features\n\n- A\n");
		// Manually empty the list to simulate post-dedup state
		for (const node of tree.children) {
			if (node.type === "list") {
				node.children = [];
			}
		}
		// Call the plugin transformer directly — cast to bypass unified's `this` typing
		const run = (NormalizeFormatPlugin as () => (tree: Root) => void)();
		run(tree);
		const listNodes = tree.children.filter((n) => n.type === "list");
		expect(listNodes).toHaveLength(0);
	});

	it("handles empty document gracefully", () => {
		const result = transform("");
		expect(result.trim()).toBe("");
	});

	it("handles version block with only preamble text (no sections)", () => {
		const md = "## 1.0.0\n\nSome text.\n";
		const result = transform(md);
		expect(result).toContain("Some text.");
	});
});
