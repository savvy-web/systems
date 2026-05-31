import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { ChangelogTransformer } from "../../src/changesets/api/transformer.js";

describe("ChangelogTransformer.transformContent", () => {
	it("merges duplicate sections and reorders by priority", () => {
		const input = [
			"## 1.0.0",
			"",
			"### Bug Fixes",
			"",
			"- Fix A",
			"",
			"### Features",
			"",
			"- Feat A",
			"",
			"### Bug Fixes",
			"",
			"- Fix B",
			"",
		].join("\n");

		const result = ChangelogTransformer.transformContent(input);

		// Should merge duplicate Bug Fixes
		const bugFixCount = (result.match(/### Bug Fixes/g) || []).length;
		expect(bugFixCount).toBe(1);

		// Features (priority 2) should come before Bug Fixes (priority 3)
		const featIdx = result.indexOf("### Features");
		const fixIdx = result.indexOf("### Bug Fixes");
		expect(featIdx).toBeLessThan(fixIdx);

		// All items should be present
		expect(result).toContain("Feat A");
		expect(result).toContain("Fix A");
		expect(result).toContain("Fix B");
	});

	it("deduplicates list items", () => {
		const input = "## 1.0.0\n\n### Features\n\n- Added login\n- Added login\n- Added signup\n";
		const result = ChangelogTransformer.transformContent(input);
		const loginCount = (result.match(/Added login/g) || []).length;
		expect(loginCount).toBe(1);
		expect(result).toContain("Added signup");
	});

	it("extracts contributor attributions", () => {
		const input = "## 1.0.0\n\n### Features\n\n- Added X Thanks [@alice](https://github.com/alice)!\n";
		const result = ChangelogTransformer.transformContent(input);
		expect(result).toContain("Thanks to");
		expect(result).toContain("@alice");
		expect(result).toContain("contributions");
	});

	it("converts issue links to reference-style", () => {
		const input = "## 1.0.0\n\n### Bug Fixes\n\n- Fixed [#42](https://github.com/org/repo/issues/42)\n";
		const result = ChangelogTransformer.transformContent(input);
		expect(result).toMatch(/\[#42\]:/);
	});

	it("removes empty sections", () => {
		const input = "## 1.0.0\n\n### Features\n\n### Bug Fixes\n\n- Fix A\n";
		const result = ChangelogTransformer.transformContent(input);
		expect(result).not.toContain("### Features");
		expect(result).toContain("### Bug Fixes");
	});

	it("passes through clean content without corruption", () => {
		const input = "## 1.0.0\n\n### Features\n\n- Added X\n";
		const result = ChangelogTransformer.transformContent(input);
		expect(result).toContain("## 1.0.0");
		expect(result).toContain("### Features");
		expect(result).toContain("Added X");
	});

	it("handles empty/minimal content", () => {
		const result = ChangelogTransformer.transformContent("");
		expect(result.trim()).toBe("");
	});

	it("full round-trip: merge + reorder + dedup + contributors + refs", () => {
		const input = [
			"## 1.0.0",
			"",
			"### Bug Fixes",
			"",
			"- Fix A [#10](https://github.com/org/repo/issues/10) Thanks [@bob](https://github.com/bob)!",
			"",
			"### Features",
			"",
			"- Feat A Thanks [@alice](https://github.com/alice)!",
			"- Feat A Thanks [@alice](https://github.com/alice)!",
			"",
			"### Bug Fixes",
			"",
			"- Fix B",
			"",
		].join("\n");

		const result = ChangelogTransformer.transformContent(input);

		// Merged: one Features, one Bug Fixes
		expect((result.match(/### Features/g) || []).length).toBe(1);
		expect((result.match(/### Bug Fixes/g) || []).length).toBe(1);

		// Reordered: Features before Bug Fixes
		expect(result.indexOf("### Features")).toBeLessThan(result.indexOf("### Bug Fixes"));

		// Deduplicated: "Feat A" appears once
		expect((result.match(/Feat A/g) || []).length).toBe(1);

		// Contributors aggregated
		expect(result).toContain("Thanks to");

		// Issue ref converted
		expect(result).toMatch(/\[#10\]:/);
	});
});

describe("ChangelogTransformer.transformFile", () => {
	let tempDir: string;

	beforeEach(() => {
		tempDir = mkdtempSync(join(tmpdir(), "changelog-transform-"));
	});

	afterEach(() => {
		rmSync(tempDir, { recursive: true });
	});

	it("transforms a file in-place", () => {
		const filePath = join(tempDir, "CHANGELOG.md");
		const input = "## 1.0.0\n\n### Bug Fixes\n\n- Fix A\n\n### Features\n\n- Feat A\n";
		writeFileSync(filePath, input);

		ChangelogTransformer.transformFile(filePath);

		const result = readFileSync(filePath, "utf-8");
		// Features should be reordered before Bug Fixes
		expect(result.indexOf("### Features")).toBeLessThan(result.indexOf("### Bug Fixes"));
	});
});
