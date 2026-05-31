import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import remarkStringify from "remark-stringify";
import { unified } from "unified";
import { describe, expect, it } from "vitest";

import { DeduplicateItemsPlugin } from "../../src/changesets/remark/plugins/deduplicate-items.js";

function transform(md: string): string {
	return String(
		unified().use(remarkParse).use(remarkGfm).use(DeduplicateItemsPlugin).use(remarkStringify).processSync(md),
	);
}

describe("deduplicate-items", () => {
	it("is a no-op when no duplicate items exist", () => {
		const md = "## 1.0.0\n\n### Features\n\n- A\n- B\n- C\n";
		const result = transform(md);
		expect(result).toContain("A");
		expect(result).toContain("B");
		expect(result).toContain("C");
	});

	it("removes exact duplicate items", () => {
		const md = "## 1.0.0\n\n### Features\n\n- Added login\n- Added login\n- Added signup\n";
		const result = transform(md);
		const loginCount = (result.match(/Added login/g) || []).length;
		expect(loginCount).toBe(1);
		expect(result).toContain("Added signup");
	});

	it("preserves similar but different items", () => {
		const md = "## 1.0.0\n\n### Features\n\n- Added login page\n- Added login API\n";
		const result = transform(md);
		expect(result).toContain("Added login page");
		expect(result).toContain("Added login API");
	});

	it("preserves duplicates across different sections (section-scoped)", () => {
		const md = "## 1.0.0\n\n### Features\n\n- Added X\n\n### Bug Fixes\n\n- Added X\n";
		const result = transform(md);
		const count = (result.match(/Added X/g) || []).length;
		expect(count).toBe(2);
	});

	it("handles multiple lists in one section", () => {
		const md = "## 1.0.0\n\n### Features\n\n- A\n- A\n\nSome text.\n\n- B\n- B\n";
		const result = transform(md);
		const aCount = (result.match(/\* A|- A/g) || []).length;
		const bCount = (result.match(/\* B|- B/g) || []).length;
		expect(aCount).toBe(1);
		expect(bCount).toBe(1);
	});

	it("removes empty list after deduplication", () => {
		// Two separate lists where second has only a duplicate — after dedup the
		// empty list should be removed. Use processSync to let the plugin run
		// via unified so we can inspect the resulting markdown.
		const md = "## 1.0.0\n\n### Features\n\n- Only item\n\n- Only item\n";
		const result = transform(md);
		// "Only item" should appear exactly once
		const count = (result.match(/Only item/g) || []).length;
		expect(count).toBe(1);
	});

	it("handles empty document gracefully", () => {
		const result = transform("");
		expect(result.trim()).toBe("");
	});

	it("is a no-op for version block with no lists", () => {
		const md = "## 1.0.0\n\n### Features\n\nSome text.\n";
		const result = transform(md);
		expect(result).toContain("Some text.");
	});
});
