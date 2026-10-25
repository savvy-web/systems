import { List, Root } from "@effected/markdown";
import { describe, expect, it } from "vitest";
import { normalizeFormat } from "../../src/changesets/transforms/normalize-format.js";
import { emitKitMarkdown, parseKitMarkdown } from "../../src/changesets/utils/markdown-emit.js";

const transform = (md: string) => emitKitMarkdown(normalizeFormat(parseKitMarkdown(md)));

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
		const parsed = parseKitMarkdown("## 1.0.0\n\n### Features\n\n- A\n");
		// Kit nodes are immutable: empty the list by rebuilding it, to simulate post-dedup state
		const tree = new Root({
			...parsed,
			children: parsed.children.map((node) => (node.type === "list" ? new List({ ...node, children: [] }) : node)),
		});
		const result = normalizeFormat(tree);
		const listNodes = result.children.filter((n) => n.type === "list");
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

	it("keeps a depth-3 section whose only lead content is a promoted #### sub-heading", () => {
		const md = "## 1.0.0\n\n### Features\n\n#### Sub-feature\n\n- Detail\n\n### Bug Fixes\n\n- Fix A\n";
		const result = transform(md);
		expect(result).toContain("### Features");
		expect(result).toContain("#### Sub-feature");
		expect(result).toContain("Detail");
	});
});
