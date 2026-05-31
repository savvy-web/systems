import { describe, expect, it } from "vitest";
import { Categories } from "../../src/changesets/api/categories.js";
import {
	BREAKING_CHANGES,
	BUG_FIXES,
	BUILD_SYSTEM,
	CATEGORIES,
	CI,
	DEPENDENCIES,
	DOCUMENTATION,
	FEATURES,
	MAINTENANCE,
	OTHER,
	PERFORMANCE,
	REFACTORING,
	REVERTS,
	TESTS,
	allHeadings,
	fromHeading,
	isValidHeading,
	resolveCommitType,
} from "../../src/changesets/categories/index.js";

describe("categories", () => {
	describe("CATEGORIES array", () => {
		it("contains exactly 13 categories", () => {
			expect(CATEGORIES).toHaveLength(13);
		});

		it("is ordered by ascending priority", () => {
			for (let i = 1; i < CATEGORIES.length; i++) {
				expect(CATEGORIES[i].priority).toBeGreaterThan(CATEGORIES[i - 1].priority);
			}
		});

		it("has unique priorities", () => {
			const priorities = CATEGORIES.map((c) => c.priority);
			expect(new Set(priorities).size).toBe(13);
		});

		it("has unique headings", () => {
			const headings = CATEGORIES.map((c) => c.heading);
			expect(new Set(headings).size).toBe(13);
		});
	});

	describe("resolveCommitType", () => {
		it.each([
			["feat", FEATURES],
			["fix", BUG_FIXES],
			["perf", PERFORMANCE],
			["docs", DOCUMENTATION],
			["refactor", REFACTORING],
			["test", TESTS],
			["build", BUILD_SYSTEM],
			["ci", CI],
			["deps", DEPENDENCIES],
			["chore", MAINTENANCE],
			["style", MAINTENANCE],
			["revert", REVERTS],
		])("maps '%s' to %s", (type, expected) => {
			expect(resolveCommitType(type)).toBe(expected);
		});

		it("maps unknown types to OTHER", () => {
			expect(resolveCommitType("unknown")).toBe(OTHER);
			expect(resolveCommitType("")).toBe(OTHER);
			expect(resolveCommitType("wip")).toBe(OTHER);
		});

		it("overrides to BREAKING_CHANGES when breaking flag is set", () => {
			expect(resolveCommitType("feat", undefined, true)).toBe(BREAKING_CHANGES);
			expect(resolveCommitType("fix", undefined, true)).toBe(BREAKING_CHANGES);
			expect(resolveCommitType("chore", undefined, true)).toBe(BREAKING_CHANGES);
			expect(resolveCommitType("unknown", undefined, true)).toBe(BREAKING_CHANGES);
		});

		it("maps chore(deps) to DEPENDENCIES, not MAINTENANCE", () => {
			expect(resolveCommitType("chore", "deps")).toBe(DEPENDENCIES);
		});

		it("maps chore with other scopes to MAINTENANCE", () => {
			expect(resolveCommitType("chore", "release")).toBe(MAINTENANCE);
			expect(resolveCommitType("chore", "config")).toBe(MAINTENANCE);
		});

		it("breaking chore(deps) maps to BREAKING_CHANGES (breaking wins)", () => {
			expect(resolveCommitType("chore", "deps", true)).toBe(BREAKING_CHANGES);
		});
	});

	describe("fromHeading", () => {
		it("looks up categories by exact heading", () => {
			expect(fromHeading("Features")).toBe(FEATURES);
			expect(fromHeading("Bug Fixes")).toBe(BUG_FIXES);
			expect(fromHeading("Breaking Changes")).toBe(BREAKING_CHANGES);
			expect(fromHeading("Other")).toBe(OTHER);
		});

		it("is case-insensitive", () => {
			expect(fromHeading("features")).toBe(FEATURES);
			expect(fromHeading("FEATURES")).toBe(FEATURES);
			expect(fromHeading("bug fixes")).toBe(BUG_FIXES);
			expect(fromHeading("BUG FIXES")).toBe(BUG_FIXES);
		});

		it("returns undefined for unknown headings", () => {
			expect(fromHeading("Unknown")).toBeUndefined();
			expect(fromHeading("")).toBeUndefined();
			expect(fromHeading("New Features")).toBeUndefined();
		});
	});

	describe("isValidHeading", () => {
		it("returns true for valid headings", () => {
			expect(isValidHeading("Features")).toBe(true);
			expect(isValidHeading("Bug Fixes")).toBe(true);
			expect(isValidHeading("Breaking Changes")).toBe(true);
		});

		it("is case-insensitive", () => {
			expect(isValidHeading("features")).toBe(true);
			expect(isValidHeading("PERFORMANCE")).toBe(true);
		});

		it("returns false for invalid headings", () => {
			expect(isValidHeading("Invalid")).toBe(false);
			expect(isValidHeading("")).toBe(false);
		});
	});

	describe("allHeadings", () => {
		it("returns all 13 headings", () => {
			expect(allHeadings()).toHaveLength(13);
		});

		it("returns headings in priority order", () => {
			const headings = allHeadings();
			expect(headings[0]).toBe("Breaking Changes");
			expect(headings[1]).toBe("Features");
			expect(headings[2]).toBe("Bug Fixes");
			expect(headings[headings.length - 1]).toBe("Other");
		});
	});
});

describe("Categories class-based API", () => {
	it("ALL exposes the CATEGORIES array", () => {
		expect(Categories.ALL).toBe(CATEGORIES);
	});

	it("fromCommitType() delegates to resolveCommitType", () => {
		expect(Categories.fromCommitType("feat")).toBe(FEATURES);
		expect(Categories.fromCommitType("chore", "deps")).toBe(DEPENDENCIES);
		expect(Categories.fromCommitType("fix", undefined, true)).toBe(BREAKING_CHANGES);
	});

	it("fromHeading() delegates to fromHeading", () => {
		expect(Categories.fromHeading("Features")).toBe(FEATURES);
		expect(Categories.fromHeading("unknown")).toBeUndefined();
	});

	it("allHeadings() delegates to allHeadings", () => {
		expect(Categories.allHeadings()).toHaveLength(13);
	});

	it("isValidHeading() delegates to isValidHeading", () => {
		expect(Categories.isValidHeading("Features")).toBe(true);
		expect(Categories.isValidHeading("nope")).toBe(false);
	});
});
