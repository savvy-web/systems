import { describe, expect, it } from "vitest";

import { stripFrontmatter } from "../../src/changesets/utils/strip-frontmatter.js";

describe("stripFrontmatter", () => {
	it("removes YAML frontmatter from content", () => {
		const input = '---\n"@savvy-web/changesets": minor\n---\n\n## Features\n\n- Added lint rules\n';
		const result = stripFrontmatter(input);
		expect(result).toBe("\n## Features\n\n- Added lint rules\n");
	});

	it("returns content as-is when no frontmatter is present", () => {
		const input = "## Features\n\n- Added lint rules\n";
		const result = stripFrontmatter(input);
		expect(result).toBe(input);
	});

	it("handles empty body after frontmatter", () => {
		const input = '---\n"@savvy-web/changesets": patch\n---\n';
		const result = stripFrontmatter(input);
		expect(result).toBe("");
	});

	it("handles frontmatter-only file without trailing newline", () => {
		const input = '---\n"@savvy-web/changesets": patch\n---';
		const result = stripFrontmatter(input);
		expect(result).toBe("");
	});

	it("handles multi-line frontmatter", () => {
		const input = '---\n"@savvy-web/changesets": minor\n"@savvy-web/other": patch\n---\n\nBody content\n';
		const result = stripFrontmatter(input);
		expect(result).toBe("\nBody content\n");
	});

	it("does not strip frontmatter-like blocks in the middle of content", () => {
		const input = "## Features\n\n---\nsome: yaml\n---\n\nMore content\n";
		const result = stripFrontmatter(input);
		expect(result).toBe(input);
	});

	it("handles empty string input", () => {
		expect(stripFrontmatter("")).toBe("");
	});
});
