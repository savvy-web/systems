import { lint } from "markdownlint/sync";
import { describe, expect, it } from "vitest";
import { UncategorizedContentRule } from "../../src/changesets/markdownlint/rules/uncategorized-content.js";
import { RULE_DOCS } from "../../src/changesets/markdownlint/rules/utils.js";

function check(markdown: string) {
	const result = lint({
		strings: { test: markdown },
		customRules: [UncategorizedContentRule],
		config: { default: false, CSH004: true },
	});
	return (result.test ?? []).map((e) => e.errorDetail ?? "");
}

describe("markdownlint/uncategorized-content", () => {
	// Valid cases
	it("passes with content under h2 heading", () => {
		expect(check("## Features\n\n- Added CLI\n")).toEqual([]);
	});

	it("passes with multiple sections", () => {
		const md = "## Features\n\n- Added X\n\n## Bug Fixes\n\n- Fixed Y\n";
		expect(check(md)).toEqual([]);
	});

	it("passes with empty document", () => {
		expect(check("")).toEqual([]);
	});

	it("passes with only an h2 heading", () => {
		expect(check("## Features\n")).toEqual([]);
	});

	it("passes with h2 followed by h3 subsections", () => {
		const md = "## Features\n\n### API\n\n- Added endpoint\n";
		expect(check(md)).toEqual([]);
	});

	// Invalid cases
	it("rejects bare paragraph before first h2", () => {
		const md = "This is uncategorized text.\n\n## Features\n\n- Added CLI\n";
		const messages = check(md);
		expect(messages).toHaveLength(1);
		expect(messages[0]).toContain("category heading");
		expect(messages[0]).toContain("## Features");
	});

	it("rejects bare list before first h2", () => {
		const md = "- Uncategorized item\n\n## Features\n\n- Added CLI\n";
		const messages = check(md);
		expect(messages).toHaveLength(1);
		expect(messages[0]).toContain("category heading");
	});

	it("rejects bare code block before first h2", () => {
		const md = "```ts\nconst x = 1;\n```\n\n## Features\n\n- Added CLI\n";
		const messages = check(md);
		expect(messages).toHaveLength(1);
		expect(messages[0]).toContain("category heading");
	});

	it("rejects content with no headings at all", () => {
		const md = "Just a paragraph with no headings.\n";
		const messages = check(md);
		expect(messages).toHaveLength(1);
		expect(messages[0]).toContain("category heading");
	});

	it("rejects multiple uncategorized nodes before first h2", () => {
		const md = "First paragraph.\n\n- A list\n\n## Features\n\n- Added CLI\n";
		const messages = check(md);
		expect(messages).toHaveLength(2);
	});

	it("does not flag content after the first h2", () => {
		const md = "## Features\n\nValid content here.\n\nMore valid content.\n";
		expect(check(md)).toEqual([]);
	});

	// HTML comment cases
	it("ignores HTML comment before first h2", () => {
		const md = "<!-- note -->\n\n## Features\n\n- Added CLI\n";
		expect(check(md)).toEqual([]);
	});

	it("ignores HTML comment with no headings", () => {
		expect(check("<!-- just a comment -->\n")).toEqual([]);
	});

	it("includes documentation URL in error messages", () => {
		const messages = check("Uncategorized text.\n");
		expect(messages[0]).toContain(RULE_DOCS.CSH004);
	});
});
