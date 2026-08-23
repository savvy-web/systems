import { lint } from "markdownlint/sync";
import { describe, expect, it } from "vitest";
import { ContentStructureRule } from "../../src/changesets/markdownlint/rules/content-structure.js";
import { RULE_DOCS } from "../../src/changesets/markdownlint/rules/utils.js";

function check(markdown: string) {
	const result = lint({
		strings: { test: markdown },
		customRules: [ContentStructureRule],
		config: { default: false, CSH003: true },
	});
	return (result.test ?? []).map((e) => e.errorDetail ?? "");
}

describe("markdownlint/content-structure", () => {
	// Valid cases
	it("passes with section containing a paragraph", () => {
		expect(check("## Features\n\nSome content here.\n")).toEqual([]);
	});

	it("passes with section containing a list", () => {
		expect(check("## Features\n\n- Item one\n- Item two\n")).toEqual([]);
	});

	it("passes with code block that has a language", () => {
		expect(check("```ts\nconst x = 1;\n```\n")).toEqual([]);
	});

	it("passes with multiple valid sections", () => {
		const md = "## Features\n\n- Added X\n\n## Bug Fixes\n\n- Fixed Y\n";
		expect(check(md)).toEqual([]);
	});

	it("passes with h3 subsection under h2", () => {
		const md = "## Features\n\n### API\n\n- Added endpoint\n";
		expect(check(md)).toEqual([]);
	});

	// Empty section cases
	it("rejects empty section (h2 followed by h2)", () => {
		const md = "## Features\n\n## Bug Fixes\n\nContent\n";
		const messages = check(md);
		expect(messages).toHaveLength(1);
		expect(messages[0]).toContain("Empty section");
		expect(messages[0]).toContain("Add a list of changes");
	});

	it("rejects empty section at end of file", () => {
		const md = "## Features\n\n- Content\n\n## Bug Fixes\n";
		const messages = check(md);
		expect(messages).toHaveLength(1);
		expect(messages[0]).toContain("Empty section");
	});

	it("rejects multiple empty sections", () => {
		const md = "## Features\n\n## Bug Fixes\n\n## Other\n\nContent\n";
		const messages = check(md);
		expect(messages).toHaveLength(2);
	});

	// Code block cases
	it("rejects code block without language", () => {
		const md = "```\nconst x = 1;\n```\n";
		const messages = check(md);
		expect(messages).toHaveLength(1);
		expect(messages[0]).toContain("missing a language identifier");
		expect(messages[0]).toContain("```ts");
	});

	it("rejects code block with empty string language", () => {
		const md = "```\ncode here\n```\n";
		const messages = check(md);
		expect(messages).toHaveLength(1);
	});

	// List item cases
	it("rejects empty list item", () => {
		const md = "- \n";
		const messages = check(md);
		expect(messages).toHaveLength(1);
		expect(messages[0]).toContain("Empty list item");
		expect(messages[0]).toContain("must contain descriptive text");
	});

	it("passes list items with content", () => {
		expect(check("- Valid item\n- Another item\n")).toEqual([]);
	});

	// Multiple violation types
	it("reports violations from multiple rule checks", () => {
		const md = "## Features\n\n## Bug Fixes\n\n```\ncode\n```\n\n- \n";
		const messages = check(md);
		expect(messages.length).toBeGreaterThanOrEqual(3);
		expect(messages.some((m) => m.includes("Empty section"))).toBe(true);
		expect(messages.some((m) => m.includes("language identifier"))).toBe(true);
		expect(messages.some((m) => m.includes("Empty list item"))).toBe(true);
	});

	it("includes documentation URL in error messages", () => {
		const messages = check("## Features\n\n## Bug Fixes\n\nContent\n");
		expect(messages[0]).toContain(RULE_DOCS.CSH003);
	});

	it("rejects an empty setext h2 section like its remark sibling", () => {
		const messages = check("Features\n--------\n");
		expect(messages).toHaveLength(1);
		expect(messages[0]).toContain("Empty section");
	});
});
