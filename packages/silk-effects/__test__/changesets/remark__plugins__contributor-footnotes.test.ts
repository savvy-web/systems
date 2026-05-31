import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import remarkStringify from "remark-stringify";
import { unified } from "unified";
import { describe, expect, it } from "vitest";

import { ContributorFootnotesPlugin } from "../../src/changesets/remark/plugins/contributor-footnotes.js";

function transform(md: string): string {
	return String(
		unified().use(remarkParse).use(remarkGfm).use(ContributorFootnotesPlugin).use(remarkStringify).processSync(md),
	);
}

describe("contributor-footnotes", () => {
	it("is a no-op when no attributions exist", () => {
		const md = "## 1.0.0\n\n### Features\n\n- Added X\n";
		const result = transform(md);
		expect(result).not.toContain("Thanks to");
		expect(result).not.toContain("contributions");
	});

	it("extracts a single contributor with link", () => {
		const md = "## 1.0.0\n\n### Features\n\n- Added X Thanks [@alice](https://github.com/alice)!\n";
		const result = transform(md);
		expect(result).toContain("Thanks to");
		expect(result).toContain("@alice");
		expect(result).toContain("contributions");
		// Attribution should be removed from the list item
		expect(result).not.toMatch(/Thanks \[@alice\]/);
	});

	it("extracts a single contributor without link", () => {
		const md = "## 1.0.0\n\n### Features\n\n- Added X Thanks @bob!\n";
		const result = transform(md);
		expect(result).toContain("Thanks to");
		expect(result).toContain("@bob");
		expect(result).toContain("contributions");
	});

	it("deduplicates the same contributor from multiple items", () => {
		const md =
			"## 1.0.0\n\n### Features\n\n- Added X Thanks [@alice](https://github.com/alice)!\n- Added Y Thanks [@alice](https://github.com/alice)!\n";
		const result = transform(md);
		// @alice should appear only once in the contributors paragraph
		const thanksSection = result.slice(result.indexOf("Thanks to"));
		const aliceCount = (thanksSection.match(/@alice/g) || []).length;
		expect(aliceCount).toBe(1);
	});

	it("aggregates multiple contributors", () => {
		const md =
			"## 1.0.0\n\n### Features\n\n- Added X Thanks [@alice](https://github.com/alice)!\n- Fixed Y Thanks [@bob](https://github.com/bob)!\n";
		const result = transform(md);
		expect(result).toContain("@alice");
		expect(result).toContain("@bob");
		expect(result).toContain("and");
	});

	it("handles multiple version blocks with different contributors", () => {
		const md =
			"## 2.0.0\n\n### Features\n\n- A Thanks [@alice](https://github.com/alice)!\n\n## 1.0.0\n\n### Features\n\n- B Thanks [@bob](https://github.com/bob)!\n";
		const result = transform(md);
		// Both contributors should appear in their respective blocks
		expect(result).toContain("@alice");
		expect(result).toContain("@bob");
	});

	it("only matches attribution at end of text", () => {
		const md = "## 1.0.0\n\n### Features\n\n- Thanks @alice! Added X for fun\n";
		const result = transform(md);
		// This attribution is NOT at the end, so it should not be extracted
		expect(result).not.toContain("contributions");
	});

	it("removes attribution text from list items", () => {
		const md = "## 1.0.0\n\n### Features\n\n- Added login Thanks [@alice](https://github.com/alice)!\n";
		const result = transform(md);
		// The list item should still have "Added login" but not the attribution
		expect(result).toContain("Added login");
	});

	it("handles three or more contributors with Oxford comma", () => {
		const md =
			"## 1.0.0\n\n### Features\n\n- A Thanks [@alice](https://github.com/alice)!\n- B Thanks [@bob](https://github.com/bob)!\n- C Thanks [@carol](https://github.com/carol)!\n";
		const result = transform(md);
		expect(result).toContain("@alice");
		expect(result).toContain("@bob");
		expect(result).toContain("@carol");
	});

	it("handles empty document gracefully", () => {
		const result = transform("");
		expect(result.trim()).toBe("");
	});
});
