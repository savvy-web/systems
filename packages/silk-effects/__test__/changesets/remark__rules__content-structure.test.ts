import remarkParse from "remark-parse";
import remarkStringify from "remark-stringify";
import { unified } from "unified";
import { describe, expect, it } from "vitest";
import { RULE_DOCS } from "../../src/changesets/constants.js";
import { ContentStructureRule } from "../../src/changesets/remark/rules/content-structure.js";

function lint(markdown: string) {
	const processor = unified().use(remarkParse).use(remarkStringify).use(ContentStructureRule);
	const file = processor.processSync(markdown);
	return file.messages.map((m) => m.message);
}

describe("content-structure", () => {
	// Valid cases
	it("passes with section containing a paragraph", () => {
		expect(lint("## Features\n\nSome content here.\n")).toEqual([]);
	});

	it("passes with section containing a list", () => {
		expect(lint("## Features\n\n- Item one\n- Item two\n")).toEqual([]);
	});

	it("passes with code block that has a language", () => {
		expect(lint("```ts\nconst x = 1;\n```\n")).toEqual([]);
	});

	it("passes with multiple valid sections", () => {
		const md = "## Features\n\n- Added X\n\n## Bug Fixes\n\n- Fixed Y\n";
		expect(lint(md)).toEqual([]);
	});

	it("passes with h3 subsection under h2", () => {
		const md = "## Features\n\n### API\n\n- Added endpoint\n";
		expect(lint(md)).toEqual([]);
	});

	// Empty section cases
	it("rejects empty section (h2 followed by h2)", () => {
		const md = "## Features\n\n## Bug Fixes\n\nContent\n";
		const messages = lint(md);
		expect(messages).toHaveLength(1);
		expect(messages[0]).toContain("Empty section");
		expect(messages[0]).toContain("Add a list of changes");
	});

	it("rejects empty section at end of file", () => {
		const md = "## Features\n\n- Content\n\n## Bug Fixes\n";
		const messages = lint(md);
		expect(messages).toHaveLength(1);
		expect(messages[0]).toContain("Empty section");
	});

	it("rejects multiple empty sections", () => {
		const md = "## Features\n\n## Bug Fixes\n\n## Other\n\nContent\n";
		const messages = lint(md);
		expect(messages).toHaveLength(2);
	});

	// Code block cases
	it("rejects code block without language", () => {
		const md = "```\nconst x = 1;\n```\n";
		const messages = lint(md);
		expect(messages).toHaveLength(1);
		expect(messages[0]).toContain("missing a language identifier");
		expect(messages[0]).toContain("```ts");
	});

	it("rejects code block with empty string language", () => {
		// remark-parse treats ``` with no lang as lang=null
		// This tests the same thing as "without language" effectively
		const md = "```\ncode here\n```\n";
		const messages = lint(md);
		expect(messages).toHaveLength(1);
	});

	// List item cases
	it("rejects empty list item", () => {
		const md = "- \n";
		const messages = lint(md);
		expect(messages).toHaveLength(1);
		expect(messages[0]).toContain("Empty list item");
		expect(messages[0]).toContain("must contain descriptive text");
	});

	it("passes list items with content", () => {
		expect(lint("- Valid item\n- Another item\n")).toEqual([]);
	});

	// Multiple violation types
	it("reports violations from multiple rule checks", () => {
		const md = "## Features\n\n## Bug Fixes\n\n```\ncode\n```\n\n- \n";
		const messages = lint(md);
		expect(messages.length).toBeGreaterThanOrEqual(3);
		expect(messages.some((m) => m.includes("Empty section"))).toBe(true);
		expect(messages.some((m) => m.includes("language identifier"))).toBe(true);
		expect(messages.some((m) => m.includes("Empty list item"))).toBe(true);
	});

	it("includes documentation URL in error messages", () => {
		const messages = lint("## Features\n\n## Bug Fixes\n\nContent\n");
		expect(messages[0]).toContain(RULE_DOCS.CSH003);
	});
});
