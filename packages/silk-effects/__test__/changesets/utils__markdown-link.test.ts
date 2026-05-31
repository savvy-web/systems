import { describe, expect, it } from "vitest";

import { MARKDOWN_LINK_PATTERN, extractUrlFromMarkdown } from "../../src/changesets/utils/markdown-link.js";

describe("MARKDOWN_LINK_PATTERN", () => {
	it("matches a markdown link", () => {
		const match = MARKDOWN_LINK_PATTERN.exec("[#42](https://github.com/owner/repo/pull/42)");
		expect(match?.[1]).toBe("#42");
		expect(match?.[2]).toBe("https://github.com/owner/repo/pull/42");
	});

	it("does not match a plain URL", () => {
		const match = MARKDOWN_LINK_PATTERN.exec("https://example.com");
		expect(match).toBeNull();
	});
});

describe("extractUrlFromMarkdown", () => {
	it("extracts URL from a markdown link", () => {
		expect(extractUrlFromMarkdown("[#17](https://github.com/owner/repo/pull/17)")).toBe(
			"https://github.com/owner/repo/pull/17",
		);
	});

	it("extracts URL from a user markdown link", () => {
		expect(extractUrlFromMarkdown("[@octocat](https://github.com/octocat)")).toBe("https://github.com/octocat");
	});

	it("returns a plain URL unchanged", () => {
		expect(extractUrlFromMarkdown("https://github.com/owner/repo/pull/42")).toBe(
			"https://github.com/owner/repo/pull/42",
		);
	});

	it("returns non-URL text unchanged", () => {
		expect(extractUrlFromMarkdown("some plain text")).toBe("some plain text");
	});
});
