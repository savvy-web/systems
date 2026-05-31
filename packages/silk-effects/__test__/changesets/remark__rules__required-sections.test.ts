import remarkParse from "remark-parse";
import remarkStringify from "remark-stringify";
import { unified } from "unified";
import { describe, expect, it } from "vitest";
import { RULE_DOCS } from "../../src/changesets/constants.js";
import { RequiredSectionsRule } from "../../src/changesets/remark/rules/required-sections.js";

function lint(markdown: string) {
	const processor = unified().use(remarkParse).use(remarkStringify).use(RequiredSectionsRule);
	const file = processor.processSync(markdown);
	return file.messages.map((m) => m.message);
}

describe("required-sections", () => {
	// Valid cases
	it("passes with a valid heading", () => {
		expect(lint("## Features\n\nContent\n")).toEqual([]);
	});

	it("passes with multiple valid headings", () => {
		const md = "## Features\n\nContent\n\n## Bug Fixes\n\nContent\n";
		expect(lint(md)).toEqual([]);
	});

	it("passes with all 13 category headings", () => {
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
		const md = headings.map((h) => `## ${h}\n\nContent\n`).join("\n");
		expect(lint(md)).toEqual([]);
	});

	it("passes with case-insensitive match", () => {
		expect(lint("## features\n\nContent\n")).toEqual([]);
		expect(lint("## FEATURES\n\nContent\n")).toEqual([]);
		expect(lint("## bug fixes\n\nContent\n")).toEqual([]);
	});

	it("ignores non-h2 headings", () => {
		expect(lint("### Random Subsection\n\nContent\n")).toEqual([]);
		expect(lint("#### Deep Heading\n\nContent\n")).toEqual([]);
	});

	it("passes with no headings", () => {
		expect(lint("Just a paragraph\n")).toEqual([]);
	});

	// Invalid cases
	it("rejects an unknown heading", () => {
		const messages = lint("## Improvements\n\nContent\n");
		expect(messages).toHaveLength(1);
		expect(messages[0]).toContain('Unknown section "Improvements"');
		expect(messages[0]).toContain("Valid h2 headings are:");
		expect(messages[0]).toContain("case-insensitive");
	});

	it("rejects a typo heading", () => {
		const messages = lint("## Featurs\n\nContent\n");
		expect(messages).toHaveLength(1);
		expect(messages[0]).toContain('Unknown section "Featurs"');
	});

	it("reports multiple unknown headings", () => {
		const md = "## Foo\n\nContent\n\n## Bar\n\nContent\n";
		const messages = lint(md);
		expect(messages).toHaveLength(2);
	});

	it("includes valid headings list in error message", () => {
		const messages = lint("## Unknown\n\nContent\n");
		expect(messages[0]).toContain("Features");
		expect(messages[0]).toContain("Bug Fixes");
		expect(messages[0]).toContain("Breaking Changes");
	});

	it("rejects empty heading text", () => {
		const messages = lint("## \n\nContent\n");
		expect(messages).toHaveLength(1);
		expect(messages[0]).toContain('Unknown section ""');
	});

	it("includes documentation URL in error messages", () => {
		const messages = lint("## Invalid\n\nContent\n");
		expect(messages[0]).toContain(RULE_DOCS.CSH002);
	});
});
