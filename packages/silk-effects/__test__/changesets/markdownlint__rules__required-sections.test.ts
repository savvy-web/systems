import { lint } from "markdownlint/sync";
import { describe, expect, it } from "vitest";
import { RequiredSectionsRule } from "../../src/changesets/markdownlint/rules/required-sections.js";
import { RULE_DOCS } from "../../src/changesets/markdownlint/rules/utils.js";

function check(markdown: string) {
	const result = lint({
		strings: { test: markdown },
		customRules: [RequiredSectionsRule],
		config: { default: false, CSH002: true },
	});
	return (result.test ?? []).map((e) => e.errorDetail ?? "");
}

describe("markdownlint/required-sections", () => {
	// Valid cases
	it("passes with a valid heading", () => {
		expect(check("## Features\n\nContent\n")).toEqual([]);
	});

	it("passes with multiple valid headings", () => {
		const md = "## Features\n\nContent\n\n## Bug Fixes\n\nContent\n";
		expect(check(md)).toEqual([]);
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
		expect(check(md)).toEqual([]);
	});

	it("passes with case-insensitive match", () => {
		expect(check("## features\n\nContent\n")).toEqual([]);
		expect(check("## FEATURES\n\nContent\n")).toEqual([]);
		expect(check("## bug fixes\n\nContent\n")).toEqual([]);
	});

	it("ignores non-h2 headings", () => {
		expect(check("### Random Subsection\n\nContent\n")).toEqual([]);
		expect(check("#### Deep Heading\n\nContent\n")).toEqual([]);
	});

	it("passes with no headings", () => {
		expect(check("Just a paragraph\n")).toEqual([]);
	});

	// Invalid cases
	it("rejects an unknown heading", () => {
		const messages = check("## Improvements\n\nContent\n");
		expect(messages).toHaveLength(1);
		expect(messages[0]).toContain('Unknown section "Improvements"');
		expect(messages[0]).toContain("Valid h2 headings are:");
		expect(messages[0]).toContain("case-insensitive");
	});

	it("rejects a typo heading", () => {
		const messages = check("## Featurs\n\nContent\n");
		expect(messages).toHaveLength(1);
		expect(messages[0]).toContain('Unknown section "Featurs"');
	});

	it("reports multiple unknown headings", () => {
		const md = "## Foo\n\nContent\n\n## Bar\n\nContent\n";
		const messages = check(md);
		expect(messages).toHaveLength(2);
	});

	it("includes valid headings list in error message", () => {
		const messages = check("## Unknown\n\nContent\n");
		expect(messages[0]).toContain("Features");
		expect(messages[0]).toContain("Bug Fixes");
		expect(messages[0]).toContain("Breaking Changes");
	});

	it("rejects empty heading text", () => {
		const messages = check("## \n\nContent\n");
		expect(messages).toHaveLength(1);
		expect(messages[0]).toContain('Unknown section ""');
	});

	it("includes documentation URL in error messages", () => {
		const messages = check("## Invalid\n\nContent\n");
		expect(messages[0]).toContain(RULE_DOCS.CSH002);
	});
	it("rejects an unknown setext h2 section like its remark sibling", () => {
		const messages = check("Bogus Section\n-------------\n\nContent\n");
		expect(messages).toHaveLength(1);
		expect(messages[0]).toContain('Unknown section "Bogus Section"');
	});
});

// --- issue #367: shared extractors resolve escapes -----------------------------
// getHeadingText reads RAW micromark source while the sibling remark rule reads
// the parsed tree via mdast-util-to-string. Both must judge the same heading.
describe("markdownlint/required-sections: backslash escapes in headings", () => {
	it("does not treat a backslash before a space as an escape", () => {
		// CommonMark escapes ASCII punctuation only, so `\ ` is a literal
		// backslash and this is genuinely a different heading.
		expect(check("## Bug Fixes\n\nContent\n")).toEqual([]);
		expect(check("## Bug\\ Fixes\n\nContent\n")).not.toEqual([]);
	});

	it("treats an escaped-punctuation heading the same as its parsed form", () => {
		// `\_` parses to `_`, so an escaped and unescaped heading are one heading.
		expect(check("## Other\n\nContent\n")).toEqual([]);
		expect(check("## Bug\\_Fixes\n\nContent\n")).toEqual(check("## Bug_Fixes\n\nContent\n"));
	});
});
