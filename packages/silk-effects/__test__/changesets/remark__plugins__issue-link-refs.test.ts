import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import remarkStringify from "remark-stringify";
import { unified } from "unified";
import { describe, expect, it } from "vitest";

import { IssueLinkRefsPlugin } from "../../src/changesets/remark/plugins/issue-link-refs.js";

function transform(md: string): string {
	return String(
		unified().use(remarkParse).use(remarkGfm).use(IssueLinkRefsPlugin).use(remarkStringify).processSync(md),
	);
}

describe("issue-link-refs", () => {
	it("is a no-op when no issue links exist", () => {
		const md = "## 1.0.0\n\n### Features\n\n- Added X\n";
		const result = transform(md);
		expect(result).toContain("Added X");
		expect(result).not.toMatch(/^\[#\d+\]:/m);
	});

	it("converts a single issue link to reference-style", () => {
		const md = "## 1.0.0\n\n### Features\n\n- Fixed [#42](https://github.com/org/repo/issues/42)\n";
		const result = transform(md);
		// Should have reference-style link
		expect(result).toMatch(/\[#42\]/);
		// Should have definition at end
		expect(result).toMatch(/\[#42\]: https:\/\/github\.com\/org\/repo\/issues\/42/);
	});

	it("converts multiple issue links with definitions ordered numerically", () => {
		const md =
			"## 1.0.0\n\n### Features\n\n- Fixed [#99](https://github.com/org/repo/issues/99)\n- Fixed [#5](https://github.com/org/repo/issues/5)\n";
		const result = transform(md);
		const def5Idx = result.indexOf("[#5]: ");
		const def99Idx = result.indexOf("[#99]: ");
		expect(def5Idx).toBeGreaterThan(-1);
		expect(def99Idx).toBeGreaterThan(-1);
		expect(def5Idx).toBeLessThan(def99Idx);
	});

	it("deduplicates same issue referenced multiple times", () => {
		const md =
			"## 1.0.0\n\n### Features\n\n- A [#10](https://github.com/org/repo/issues/10)\n- B [#10](https://github.com/org/repo/issues/10)\n";
		const result = transform(md);
		const defCount = (result.match(/\[#10\]:/g) || []).length;
		expect(defCount).toBe(1);
	});

	it("preserves non-issue links", () => {
		const md = "## 1.0.0\n\n### Features\n\n- See [commit](https://github.com/org/repo/commit/abc123)\n";
		const result = transform(md);
		// Should not create a definition for non-issue link
		expect(result).toContain("[commit](https://github.com/org/repo/commit/abc123)");
	});

	it("handles multiple version blocks with independent definitions", () => {
		const md =
			"## 2.0.0\n\n### Features\n\n- A [#1](https://github.com/org/repo/issues/1)\n\n## 1.0.0\n\n### Features\n\n- B [#2](https://github.com/org/repo/issues/2)\n";
		const result = transform(md);
		expect(result).toMatch(/\[#1\]:/);
		expect(result).toMatch(/\[#2\]:/);
	});

	it("handles empty document gracefully", () => {
		const result = transform("");
		expect(result.trim()).toBe("");
	});

	it("preserves links with non-issue text", () => {
		const md = "## 1.0.0\n\n### Features\n\n- See [PR #5](https://github.com/org/repo/pull/5)\n";
		const result = transform(md);
		// "PR #5" doesn't match the #N pattern, so should remain inline
		expect(result).toContain("[PR #5]");
		expect(result).not.toMatch(/^\[PR #5\]:/m);
	});
});
