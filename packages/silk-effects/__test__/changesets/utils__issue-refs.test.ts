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

	it("handles numbers without # prefix", () => {
		expect(parseIssueReferences("Closes 123")).toEqual({
			closes: ["123"],
			fixes: [],
			refs: [],
		});
	});
});
