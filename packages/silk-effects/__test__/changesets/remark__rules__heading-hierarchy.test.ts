import remarkParse from "remark-parse";
import remarkStringify from "remark-stringify";
import { unified } from "unified";
import { describe, expect, it } from "vitest";
import { RULE_DOCS } from "../../src/changesets/constants.js";
import { HeadingHierarchyRule } from "../../src/changesets/remark/rules/heading-hierarchy.js";

function lint(markdown: string) {
	const processor = unified().use(remarkParse).use(remarkStringify).use(HeadingHierarchyRule);
	const file = processor.processSync(markdown);
	return file.messages.map((m) => m.message);
}

describe("heading-hierarchy", () => {
	// Valid cases
	it("passes with h2 only", () => {
		expect(lint("## Features\n\nSome content\n")).toEqual([]);
	});

	it("passes with h2 and h3", () => {
		expect(lint("## Features\n\n### Sub-feature\n\nContent\n")).toEqual([]);
	});

	it("passes with multiple h2 sections with h3 subsections", () => {
		const md = "## Features\n\n### API\n\nContent\n\n## Bug Fixes\n\n### UI\n\nContent\n";
		expect(lint(md)).toEqual([]);
	});

	it("passes with h2 → h3 → h4 progression", () => {
		expect(lint("## Features\n\n### API\n\n#### Details\n\nContent\n")).toEqual([]);
	});

	it("passes with no headings", () => {
		expect(lint("Just a paragraph\n")).toEqual([]);
	});

	it("passes with a single h2 heading", () => {
		expect(lint("## Features\n")).toEqual([]);
	});

	it("passes when h3 resets to h2", () => {
		const md = "## Features\n\n### Sub\n\nContent\n\n## Bug Fixes\n\nContent\n";
		expect(lint(md)).toEqual([]);
	});

	// Invalid cases
	it("rejects h1 heading", () => {
		const messages = lint("# Title\n\nContent\n");
		expect(messages).toHaveLength(1);
		expect(messages[0]).toContain("h1 headings are not allowed in changeset files");
		expect(messages[0]).toContain("Use h2 (##) for top-level sections");
		expect(messages[0]).toContain(RULE_DOCS.CSH001);
	});

	it("rejects h1 after h2", () => {
		const messages = lint("## Features\n\n# Title\n");
		expect(messages).toHaveLength(1);
		expect(messages[0]).toContain("h1 headings are not allowed in changeset files");
	});

	it("rejects h2 → h4 skip", () => {
		const messages = lint("## Features\n\n#### Details\n");
		expect(messages).toHaveLength(1);
		expect(messages[0]).toContain("Heading level skipped");
	});

	it("rejects h3 → h5 skip", () => {
		const messages = lint("## Features\n\n### Sub\n\n##### Deep\n");
		expect(messages).toHaveLength(1);
		expect(messages[0]).toContain("Heading level skipped");
	});

	it("reports multiple violations", () => {
		const md = "# Title\n\n## Features\n\n#### Skip\n";
		const messages = lint(md);
		expect(messages).toHaveLength(2);
		expect(messages[0]).toContain("h1 headings are not allowed in changeset files");
		expect(messages[1]).toContain("Heading level skipped");
	});

	it("reports correct skip details in message", () => {
		const messages = lint("## Features\n\n#### Details\n");
		expect(messages[0]).toContain("expected h3 or lower, found h4");
		expect(messages[0]).toContain("Headings must increase sequentially");
	});

	it("handles h2 → h4 after h3 resets to new h2", () => {
		const md = "## A\n\n### B\n\n## C\n\n#### D\n";
		const messages = lint(md);
		expect(messages).toHaveLength(1);
		expect(messages[0]).toContain("Heading level skipped");
	});

	it("includes documentation URL in error messages", () => {
		const messages = lint("# Title\n");
		expect(messages[0]).toContain(RULE_DOCS.CSH001);
	});
});
