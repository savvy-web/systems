import { describe, expect, it } from "vitest";

import { createRemarkProcessor, parseMarkdown, stringifyMarkdown } from "../../src/changesets/utils/remark-pipeline.js";

describe("createRemarkProcessor", () => {
	it("returns a unified processor", () => {
		const processor = createRemarkProcessor();
		expect(processor).toBeDefined();
		expect(typeof processor.parse).toBe("function");
		expect(typeof processor.stringify).toBe("function");
	});
});

describe("parseMarkdown", () => {
	it("parses a heading", () => {
		const tree = parseMarkdown("## Features");
		expect(tree.type).toBe("root");
		expect(tree.children[0].type).toBe("heading");
	});

	it("parses a list", () => {
		const tree = parseMarkdown("- item 1\n- item 2");
		expect(tree.children[0].type).toBe("list");
	});

	it("parses GFM tables", () => {
		const md = "| a | b |\n| --- | --- |\n| 1 | 2 |";
		const tree = parseMarkdown(md);
		expect(tree.children[0].type).toBe("table");
	});
});

describe("stringifyMarkdown", () => {
	it("stringifies a parsed tree back to markdown", () => {
		const tree = parseMarkdown("## Hello\n\nWorld");
		const result = stringifyMarkdown(tree);
		expect(result).toContain("## Hello");
		expect(result).toContain("World");
	});
});

describe("round-trip", () => {
	it("preserves heading structure", () => {
		const input = "## Features\n\n- item one\n";
		const tree = parseMarkdown(input);
		const output = stringifyMarkdown(tree);
		expect(output).toContain("## Features");
		expect(output).toContain("item one");
	});

	it("preserves code blocks", () => {
		const input = "```ts\nconst x = 1;\n```\n";
		const tree = parseMarkdown(input);
		const output = stringifyMarkdown(tree);
		expect(output).toContain("```ts");
		expect(output).toContain("const x = 1;");
	});

	it("preserves GFM strikethrough", () => {
		const input = "~~deleted~~\n";
		const tree = parseMarkdown(input);
		const output = stringifyMarkdown(tree);
		expect(output).toContain("~~deleted~~");
	});
});
