import { describe, expect, it } from "vitest";

import { parseChangesetSections } from "../../src/changesets/utils/section-parser.js";

describe("parseChangesetSections", () => {
	it("returns preamble only when no h2 headings", () => {
		const result = parseChangesetSections("Just a plain text summary");
		expect(result.preamble).toBe("Just a plain text summary");
		expect(result.sections).toEqual([]);
	});

	it("parses a single section", () => {
		const summary = "## Features\n\n- Added new login system";
		const result = parseChangesetSections(summary);
		expect(result.preamble).toBeUndefined();
		expect(result.sections).toHaveLength(1);
		expect(result.sections[0].heading).toBe("Features");
		expect(result.sections[0].category.heading).toBe("Features");
		expect(result.sections[0].content).toContain("Added new login system");
	});

	it("parses multiple sections", () => {
		const summary = "## Features\n\n- Feature A\n\n## Bug Fixes\n\n- Fix B";
		const result = parseChangesetSections(summary);
		expect(result.sections).toHaveLength(2);
		expect(result.sections[0].heading).toBe("Features");
		expect(result.sections[0].content).toContain("Feature A");
		expect(result.sections[1].heading).toBe("Bug Fixes");
		expect(result.sections[1].content).toContain("Fix B");
	});

	it("extracts preamble before first h2", () => {
		const summary = "Some intro text\n\n## Features\n\n- Feature A";
		const result = parseChangesetSections(summary);
		expect(result.preamble).toBe("Some intro text");
		expect(result.sections).toHaveLength(1);
		expect(result.sections[0].heading).toBe("Features");
	});

	it("skips unknown headings", () => {
		const summary = "## Features\n\n- A\n\n## Unknown Category\n\n- B\n\n## Bug Fixes\n\n- C";
		const result = parseChangesetSections(summary);
		expect(result.sections).toHaveLength(2);
		expect(result.sections[0].heading).toBe("Features");
		expect(result.sections[1].heading).toBe("Bug Fixes");
	});

	it("preserves h3 sub-headings within sections", () => {
		const summary = "## Features\n\n### Sub-feature\n\n- Detail";
		const result = parseChangesetSections(summary);
		expect(result.sections).toHaveLength(1);
		expect(result.sections[0].content).toContain("### Sub-feature");
		expect(result.sections[0].content).toContain("Detail");
	});

	it("preserves code blocks within sections", () => {
		const summary = "## Features\n\n```ts\nconst x = 1;\n```";
		const result = parseChangesetSections(summary);
		expect(result.sections).toHaveLength(1);
		expect(result.sections[0].content).toContain("const x = 1;");
	});

	it("handles empty section content", () => {
		const summary = "## Features\n\n## Bug Fixes\n\n- Fix A";
		const result = parseChangesetSections(summary);
		expect(result.sections).toHaveLength(2);
		expect(result.sections[0].content).toBe("");
		expect(result.sections[1].content).toContain("Fix A");
	});

	it("handles all 13 category headings", () => {
		const headings = [
			"Breaking Changes",
			"Features",
			"Bug Fixes",
			"Performance",
			"Documentation",
			"Refactoring",
			"Tests",
			"Build System",
			"CI",
			"Dependencies",
			"Maintenance",
			"Reverts",
			"Other",
		];
		for (const heading of headings) {
			const summary = `## ${heading}\n\n- item`;
			const result = parseChangesetSections(summary);
			expect(result.sections).toHaveLength(1);
			expect(result.sections[0].category.heading).toBe(heading);
		}
	});
});
