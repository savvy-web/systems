import { describe, expect, it } from "vitest";

import { formatChangelogEntry, formatPRAndUserAttribution } from "../../src/changesets/changelog/formatting.js";

describe("formatChangelogEntry", () => {
	const repo = "owner/repo";

	it("formats entry with commit link", () => {
		const result = formatChangelogEntry(
			{
				commit: "abc123def456789",
				type: "feat",
				summary: "add new feature",
				issues: { closes: [], fixes: [], refs: [] },
			},
			{ repo },
		);
		expect(result).toContain("[`abc123d`](https://github.com/owner/repo/commit/abc123def456789)");
		expect(result).toContain("add new feature");
	});

	it("formats entry without commit", () => {
		const result = formatChangelogEntry(
			{
				type: "fix",
				summary: "resolve bug",
				issues: { closes: [], fixes: [], refs: [] },
			},
			{ repo },
		);
		expect(result).toBe("resolve bug");
	});

	it("appends issue close references", () => {
		const result = formatChangelogEntry(
			{
				type: "fix",
				summary: "fix things",
				issues: { closes: ["123", "456"], fixes: [], refs: [] },
			},
			{ repo },
		);
		expect(result).toContain("Closes: [#123](https://github.com/owner/repo/issues/123)");
		expect(result).toContain("[#456](https://github.com/owner/repo/issues/456)");
	});

	it("appends fix and ref references", () => {
		const result = formatChangelogEntry(
			{
				type: "fix",
				summary: "fix things",
				issues: { closes: [], fixes: ["789"], refs: ["101"] },
			},
			{ repo },
		);
		expect(result).toContain("Fixes: [#789]");
		expect(result).toContain("Refs: [#101]");
	});
});

describe("formatPRAndUserAttribution", () => {
	it("returns empty string with no PR or user", () => {
		expect(formatPRAndUserAttribution()).toBe("");
	});

	it("formats PR number without link", () => {
		expect(formatPRAndUserAttribution(42)).toBe(" (#42)");
	});

	it("formats PR with link", () => {
		const result = formatPRAndUserAttribution(42, undefined, {
			pull: "https://github.com/owner/repo/pull/42",
		});
		expect(result).toBe(" [#42](https://github.com/owner/repo/pull/42)");
	});

	it("formats user without link", () => {
		expect(formatPRAndUserAttribution(undefined, "octocat")).toBe(" Thanks @octocat!");
	});

	it("formats user with link", () => {
		const result = formatPRAndUserAttribution(undefined, "octocat", {
			user: "https://github.com/octocat",
		});
		expect(result).toBe(" Thanks [@octocat](https://github.com/octocat)!");
	});

	it("formats PR and user with links", () => {
		const result = formatPRAndUserAttribution(42, "octocat", {
			pull: "https://github.com/owner/repo/pull/42",
			user: "https://github.com/octocat",
		});
		expect(result).toBe(" [#42](https://github.com/owner/repo/pull/42) Thanks [@octocat](https://github.com/octocat)!");
	});

	it("formats PR and user without links", () => {
		expect(formatPRAndUserAttribution(42, "octocat")).toBe(" (#42) Thanks @octocat!");
	});

	it("formats PR with link and user without link", () => {
		const result = formatPRAndUserAttribution(42, "octocat", {
			pull: "https://github.com/owner/repo/pull/42",
		});
		expect(result).toBe(" [#42](https://github.com/owner/repo/pull/42) Thanks @octocat!");
	});

	it("formats PR without link and user with link", () => {
		const result = formatPRAndUserAttribution(42, "octocat", {
			user: "https://github.com/octocat",
		});
		expect(result).toBe(" (#42) Thanks [@octocat](https://github.com/octocat)!");
	});

	it("handles markdown-formatted PR link", () => {
		const result = formatPRAndUserAttribution(42, undefined, {
			pull: "[#42](https://github.com/owner/repo/pull/42)",
		});
		expect(result).toBe(" [#42](https://github.com/owner/repo/pull/42)");
	});

	it("handles markdown-formatted user link", () => {
		const result = formatPRAndUserAttribution(undefined, "octocat", {
			user: "[@octocat](https://github.com/octocat)",
		});
		expect(result).toBe(" Thanks [@octocat](https://github.com/octocat)!");
	});

	it("formats PR with markdown link and user with markdown link", () => {
		const result = formatPRAndUserAttribution(42, "octocat", {
			pull: "[#42](https://github.com/owner/repo/pull/42)",
			user: "[@octocat](https://github.com/octocat)",
		});
		expect(result).toBe(" [#42](https://github.com/owner/repo/pull/42) Thanks [@octocat](https://github.com/octocat)!");
	});

	it("returns only user attribution when no PR", () => {
		const result = formatPRAndUserAttribution(undefined, "octocat", {
			user: "https://github.com/octocat",
		});
		expect(result).toBe(" Thanks [@octocat](https://github.com/octocat)!");
	});
});
