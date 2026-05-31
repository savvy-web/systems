import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { ChangesetLinter } from "../../src/changesets/api/linter.js";

describe("ChangesetLinter.validateContent", () => {
	it("returns no messages for valid content", () => {
		const content = '---\n"@savvy-web/changesets": minor\n---\n\n## Features\n\n- Added lint rules\n';
		const messages = ChangesetLinter.validateContent(content);
		expect(messages).toEqual([]);
	});

	it("detects h1 heading after stripping frontmatter", () => {
		const content = '---\n"@savvy-web/changesets": minor\n---\n\n# Title\n\nContent\n';
		const messages = ChangesetLinter.validateContent(content);
		expect(messages.length).toBeGreaterThanOrEqual(1);
		expect(messages.some((m) => m.message.includes("h1"))).toBe(true);
	});

	it("detects unknown section heading", () => {
		const content = "## Improvements\n\n- Something\n";
		const messages = ChangesetLinter.validateContent(content);
		expect(messages.some((m) => m.message.includes("Unknown section"))).toBe(true);
	});

	it("detects empty section", () => {
		const content = "## Features\n\n## Bug Fixes\n\nContent\n";
		const messages = ChangesetLinter.validateContent(content);
		expect(messages.some((m) => m.message.includes("Empty section"))).toBe(true);
	});

	it("detects code block missing language", () => {
		const content = "## Features\n\n```\ncode\n```\n";
		const messages = ChangesetLinter.validateContent(content);
		expect(messages.some((m) => m.message.includes("language identifier"))).toBe(true);
	});

	it("uses provided file path in messages", () => {
		const content = "# Bad\n";
		const messages = ChangesetLinter.validateContent(content, "my-changeset.md");
		expect(messages[0].file).toBe("my-changeset.md");
	});

	it("uses default file path when not provided", () => {
		const content = "# Bad\n";
		const messages = ChangesetLinter.validateContent(content);
		expect(messages[0].file).toBe("<input>");
	});

	it("returns structured LintMessage objects", () => {
		const content = "# Bad\n";
		const messages = ChangesetLinter.validateContent(content);
		expect(messages[0]).toEqual(
			expect.objectContaining({
				file: expect.any(String),
				rule: expect.any(String),
				line: expect.any(Number),
				column: expect.any(Number),
				message: expect.any(String),
			}),
		);
	});
});

describe("ChangesetLinter.validateFile", () => {
	let tempDir: string;

	beforeEach(() => {
		tempDir = mkdtempSync(join(tmpdir(), "changeset-lint-"));
	});

	afterEach(() => {
		rmSync(tempDir, { recursive: true });
	});

	it("validates a file from disk", () => {
		const filePath = join(tempDir, "valid.md");
		writeFileSync(filePath, '---\n"pkg": minor\n---\n\n## Features\n\n- Added X\n');
		const messages = ChangesetLinter.validateFile(filePath);
		expect(messages).toEqual([]);
	});

	it("reports errors for an invalid file", () => {
		const filePath = join(tempDir, "invalid.md");
		writeFileSync(filePath, '---\n"pkg": minor\n---\n\n# Bad Title\n');
		const messages = ChangesetLinter.validateFile(filePath);
		expect(messages.length).toBeGreaterThan(0);
		expect(messages[0].file).toBe(filePath);
	});
});

describe("ChangesetLinter.validate", () => {
	let tempDir: string;

	beforeEach(() => {
		tempDir = mkdtempSync(join(tmpdir(), "changeset-lint-dir-"));
	});

	afterEach(() => {
		rmSync(tempDir, { recursive: true });
	});

	it("validates multiple files in a directory", () => {
		writeFileSync(join(tempDir, "good.md"), '---\n"pkg": minor\n---\n\n## Features\n\n- Added X\n');
		writeFileSync(join(tempDir, "bad.md"), '---\n"pkg": patch\n---\n\n# Title\n');
		const messages = ChangesetLinter.validate(tempDir);
		expect(messages.length).toBeGreaterThan(0);
		expect(messages.every((m) => m.file.includes(tempDir))).toBe(true);
	});

	it("excludes README.md", () => {
		writeFileSync(join(tempDir, "README.md"), "# Title\n\nThis should be ignored\n");
		writeFileSync(join(tempDir, "valid.md"), '---\n"pkg": minor\n---\n\n## Features\n\n- Added X\n');
		const messages = ChangesetLinter.validate(tempDir);
		expect(messages).toEqual([]);
	});

	it("returns empty array for directory with no md files", () => {
		writeFileSync(join(tempDir, "notes.txt"), "some text");
		const messages = ChangesetLinter.validate(tempDir);
		expect(messages).toEqual([]);
	});

	it("aggregates messages from all files", () => {
		writeFileSync(join(tempDir, "a.md"), "# Bad\n");
		writeFileSync(join(tempDir, "b.md"), "## Unknown\n\n- content\n");
		const messages = ChangesetLinter.validate(tempDir);
		const files = new Set(messages.map((m) => m.file));
		expect(files.size).toBe(2);
	});
});
