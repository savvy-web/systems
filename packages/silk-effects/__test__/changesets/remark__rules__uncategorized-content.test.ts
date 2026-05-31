import remarkParse from "remark-parse";
import remarkStringify from "remark-stringify";
import { unified } from "unified";
import { describe, expect, it } from "vitest";
import { RULE_DOCS } from "../../src/changesets/constants.js";
import { UncategorizedContentRule } from "../../src/changesets/remark/rules/uncategorized-content.js";

function lint(markdown: string) {
	const processor = unified().use(remarkParse).use(remarkStringify).use(UncategorizedContentRule);
	const file = processor.processSync(markdown);
	return file.messages.map((m) => m.message);
}

describe("uncategorized-content", () => {
	// Valid cases
	it("passes with content under h2 heading", () => {
		expect(lint("## Features\n\n- Added CLI\n")).toEqual([]);
	});

	it("passes with multiple sections", () => {
		const md = "## Features\n\n- Added X\n\n## Bug Fixes\n\n- Fixed Y\n";
		expect(lint(md)).toEqual([]);
	});

	it("passes with empty document", () => {
		expect(lint("")).toEqual([]);
	});

	it("passes with only an h2 heading", () => {
		expect(lint("## Features\n")).toEqual([]);
	});

	it("passes with h2 followed by h3 subsections", () => {
		const md = "## Features\n\n### API\n\n- Added endpoint\n";
		expect(lint(md)).toEqual([]);
	});

	// Invalid cases
	it("rejects bare paragraph before first h2", () => {
		const md = "This is uncategorized text.\n\n## Features\n\n- Added CLI\n";
		const messages = lint(md);
		expect(messages).toHaveLength(1);
		expect(messages[0]).toContain("Content must be placed under a category heading");
		expect(messages[0]).toContain("## Features");
	});

	it("rejects bare list before first h2", () => {
		const md = "- Uncategorized item\n\n## Features\n\n- Added CLI\n";
		const messages = lint(md);
		expect(messages).toHaveLength(1);
		expect(messages[0]).toContain("category heading");
	});

	it("rejects bare code block before first h2", () => {
		const md = "```ts\nconst x = 1;\n```\n\n## Features\n\n- Added CLI\n";
		const messages = lint(md);
		expect(messages).toHaveLength(1);
		expect(messages[0]).toContain("category heading");
	});

	it("rejects content with no headings at all", () => {
		const md = "Just a paragraph with no headings.\n";
		const messages = lint(md);
		expect(messages).toHaveLength(1);
		expect(messages[0]).toContain("category heading");
	});

	it("rejects multiple uncategorized nodes before first h2", () => {
		const md = "First paragraph.\n\n- A list\n\n## Features\n\n- Added CLI\n";
		const messages = lint(md);
		expect(messages).toHaveLength(2);
	});

	it("rejects content before h2 even with h3 present", () => {
		const md = "Uncategorized.\n\n### Subsection\n\n## Features\n\n- Added CLI\n";
		const messages = lint(md);
		expect(messages).toHaveLength(1);
		expect(messages[0]).toContain("category heading");
	});

	it("does not flag content after the first h2", () => {
		const md = "## Features\n\nValid content here.\n\nMore valid content.\n";
		expect(lint(md)).toEqual([]);
	});

	// HTML comment cases
	it("ignores HTML comment before first h2", () => {
		const md = "<!-- note -->\n\n## Features\n\n- Added CLI\n";
		expect(lint(md)).toEqual([]);
	});

	it("ignores HTML comment with no headings", () => {
		expect(lint("<!-- just a comment -->\n")).toEqual([]);
	});

	it("includes documentation URL in error messages", () => {
		const messages = lint("Uncategorized text.\n");
		expect(messages[0]).toContain(RULE_DOCS.CSH004);
	});
});
