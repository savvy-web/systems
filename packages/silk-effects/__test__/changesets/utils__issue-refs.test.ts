import { describe, expect, it } from "vitest";

import { parseIssueReferences } from "../../src/changesets/utils/issue-refs.js";

describe("parseIssueReferences", () => {
	it("parses closes references", () => {
		expect(parseIssueReferences("Closes #123")).toEqual({
			closes: ["123"],
			fixes: [],
			refs: [],
		});
	});

	it("parses multiple closes references", () => {
		expect(parseIssueReferences("Closes #123, #456")).toEqual({
			closes: ["123", "456"],
			fixes: [],
			refs: [],
		});
	});

	it("parses fixes references", () => {
		expect(parseIssueReferences("Fixes: #789")).toEqual({
			closes: [],
			fixes: ["789"],
			refs: [],
		});
	});

	it("parses refs references", () => {
		expect(parseIssueReferences("Refs #101")).toEqual({
			closes: [],
			fixes: [],
			refs: ["101"],
		});
	});

	it("parses mixed reference types", () => {
		const msg = "Closes #123\nFixes #456\nRefs #789";
		const result = parseIssueReferences(msg);
		expect(result.closes).toEqual(["123"]);
		expect(result.fixes).toEqual(["456"]);
		expect(result.refs).toEqual(["789"]);
	});

	it("handles case-insensitive keywords", () => {
		expect(parseIssueReferences("closes #42")).toEqual({
			closes: ["42"],
			fixes: [],
			refs: [],
		});
	});

	it("handles close without 's'", () => {
		expect(parseIssueReferences("Close #42")).toEqual({
			closes: ["42"],
			fixes: [],
			refs: [],
		});
	});

	it("handles ref without 's'", () => {
		expect(parseIssueReferences("Ref #99")).toEqual({
			closes: [],
			fixes: [],
			refs: ["99"],
		});
	});

	it("returns empty arrays when no references found", () => {
		expect(parseIssueReferences("Just a regular commit message")).toEqual({
			closes: [],
			fixes: [],
			refs: [],
		});
	});

	// GitHub's grammar makes the # mandatory; the old pattern's bare-number
	// acceptance was drift from it.
	it("requires the # prefix", () => {
		expect(parseIssueReferences("Closes 123")).toEqual({
			closes: [],
			fixes: [],
			refs: [],
		});
	});

	it("categorizes the resolve family as closes", () => {
		expect(parseIssueReferences("Resolves #7")).toEqual({
			closes: ["7"],
			fixes: [],
			refs: [],
		});
	});

	it("harvests a reference embedded in prose", () => {
		expect(parseIssueReferences("This closes #12 in passing")).toEqual({
			closes: ["12"],
			fixes: [],
			refs: [],
		});
	});

	it("harvests several keyword lists from one line", () => {
		expect(parseIssueReferences("Closes #123, Fixes #456")).toEqual({
			closes: ["123"],
			fixes: ["456"],
			refs: [],
		});
	});

	// The colon spelling is line-dialect-only: the whole-line pass reads it
	// (see the `Fixes: #789` case above), the inline harvest does not — so a
	// colon trailer buried mid-prose is not a reference.
	it("does not harvest a colon spelling from mid-prose", () => {
		expect(parseIssueReferences("prose closes: #1 more prose")).toEqual({
			closes: [],
			fixes: [],
			refs: [],
		});
	});

	// A trailer line is also a valid inline harvest of itself; the per-line
	// composition must count it exactly once.
	it("never double-counts a line matched by both dialects", () => {
		expect(parseIssueReferences("Closes #42")).toEqual({
			closes: ["42"],
			fixes: [],
			refs: [],
		});
	});
});
