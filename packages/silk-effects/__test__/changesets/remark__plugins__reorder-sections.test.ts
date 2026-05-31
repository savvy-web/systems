import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import remarkStringify from "remark-stringify";
import { unified } from "unified";
import { describe, expect, it } from "vitest";

import { ReorderSectionsPlugin } from "../../src/changesets/remark/plugins/reorder-sections.js";

function transform(md: string): string {
	return String(
		unified().use(remarkParse).use(remarkGfm).use(ReorderSectionsPlugin).use(remarkStringify).processSync(md),
	);
}

describe("reorder-sections", () => {
	it("is a no-op when already in priority order", () => {
		const md = "## 1.0.0\n\n### Breaking Changes\n\n- A\n\n### Features\n\n- B\n\n### Bug Fixes\n\n- C\n";
		const result = transform(md);
		const breakingIdx = result.indexOf("### Breaking Changes");
		const featIdx = result.indexOf("### Features");
		const fixIdx = result.indexOf("### Bug Fixes");
		expect(breakingIdx).toBeLessThan(featIdx);
		expect(featIdx).toBeLessThan(fixIdx);
	});

	it("reorders reverse-priority sections to correct order", () => {
		const md = "## 1.0.0\n\n### Bug Fixes\n\n- C\n\n### Features\n\n- B\n\n### Breaking Changes\n\n- A\n";
		const result = transform(md);
		const breakingIdx = result.indexOf("### Breaking Changes");
		const featIdx = result.indexOf("### Features");
		const fixIdx = result.indexOf("### Bug Fixes");
		expect(breakingIdx).toBeLessThan(featIdx);
		expect(featIdx).toBeLessThan(fixIdx);
	});

	it("sorts unknown headings to the end", () => {
		const md = "## 1.0.0\n\n### Custom Section\n\n- X\n\n### Features\n\n- A\n";
		const result = transform(md);
		const featIdx = result.indexOf("### Features");
		const customIdx = result.indexOf("### Custom Section");
		expect(featIdx).toBeLessThan(customIdx);
	});

	it("reorders multiple version blocks independently", () => {
		const md =
			"## 2.0.0\n\n### Bug Fixes\n\n- B\n\n### Features\n\n- A\n\n## 1.0.0\n\n### Documentation\n\n- D\n\n### Performance\n\n- P\n";
		const result = transform(md);
		// In v2: Features (2) before Bug Fixes (3)
		const v2FeatIdx = result.indexOf("### Features");
		const v2FixIdx = result.indexOf("### Bug Fixes");
		expect(v2FeatIdx).toBeLessThan(v2FixIdx);
		// In v1: Performance (4) before Documentation (5)
		const perfIdx = result.indexOf("### Performance");
		const docsIdx = result.indexOf("### Documentation");
		expect(perfIdx).toBeLessThan(docsIdx);
	});

	it("preserves preamble content before first h3", () => {
		const md = "## 1.0.0\n\nPreamble text.\n\n### Bug Fixes\n\n- B\n\n### Features\n\n- A\n";
		const result = transform(md);
		expect(result).toContain("Preamble text.");
		// Preamble should appear before sections
		const preambleIdx = result.indexOf("Preamble text.");
		const featIdx = result.indexOf("### Features");
		expect(preambleIdx).toBeLessThan(featIdx);
	});

	it("is a no-op for single section", () => {
		const md = "## 1.0.0\n\n### Features\n\n- A\n";
		const result = transform(md);
		expect(result).toContain("### Features");
	});

	it("is a no-op for version block with no sections", () => {
		const md = "## 1.0.0\n\nJust text.\n";
		const result = transform(md);
		expect(result).toContain("Just text.");
	});

	it("handles empty document", () => {
		const result = transform("");
		expect(result.trim()).toBe("");
	});
});
