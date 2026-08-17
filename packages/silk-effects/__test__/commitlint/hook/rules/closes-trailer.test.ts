import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import { closesTrailerRule, hasClosingTrailer } from "../../../../src/commitlint/hook/rules/closes-trailer.js";

describe("hasClosingTrailer", () => {
	it("matches Closes #123 (case-insensitive)", () => {
		expect(hasClosingTrailer("Closes #123", 123)).toBe(true);
		expect(hasClosingTrailer("closes #123", 123)).toBe(true);
		expect(hasClosingTrailer("CLOSES #123", 123)).toBe(true);
	});

	it("matches Fixes and Resolves keywords", () => {
		expect(hasClosingTrailer("Fixes #123", 123)).toBe(true);
		expect(hasClosingTrailer("RESOLVES #123", 123)).toBe(true);
	});

	it("requires the # prefix", () => {
		expect(hasClosingTrailer("closes 123", 123)).toBe(false);
	});

	it("requires the specific number", () => {
		expect(hasClosingTrailer("Closes #5", 123)).toBe(false);
	});

	// GitHub accepts all nine closing keyword tenses; the old pattern's
	// present-plural-only set was drift from that grammar.
	it("accepts every closing keyword tense GitHub does", () => {
		expect(hasClosingTrailer("close #123", 123)).toBe(true);
		expect(hasClosingTrailer("Fixed #123", 123)).toBe(true);
		expect(hasClosingTrailer("Resolved #123", 123)).toBe(true);
	});

	// The house format puts every issue on one comma-separated trailer, so
	// every id in the list has to count — not just the first.
	it("matches any id in a comma-separated list, not only the first", () => {
		const trailer = "Closes #247, #248, #251, #252";
		expect(hasClosingTrailer(trailer, 247)).toBe(true);
		expect(hasClosingTrailer(trailer, 248)).toBe(true);
		expect(hasClosingTrailer(trailer, 252)).toBe(true);
		expect(hasClosingTrailer(trailer, 999)).toBe(false);
	});

	it("matches across a full message with a spaced trailer block", () => {
		const message = [
			"feat(actions): canonicalize skills",
			"",
			"- Consolidate Actions skills into indexed guidance",
			"",
			"Closes #16, #17, #18",
			"",
			"Signed-off-by: C. Spencer Beggs <spencer@savvyweb.systems>",
		].join("\n");
		expect(hasClosingTrailer(message, 17)).toBe(true);
		expect(hasClosingTrailer(message, 18)).toBe(true);
		expect(hasClosingTrailer(message, 19)).toBe(false);
	});

	it("accepts the 'and' and colon spellings", () => {
		expect(hasClosingTrailer("Closes #1 and #2", 2)).toBe(true);
		expect(hasClosingTrailer("Closes: #1, #2", 2)).toBe(true);
	});

	it("does not treat a bare reference as closing an issue", () => {
		// #99 appears, but no closing keyword governs it.
		expect(hasClosingTrailer("Follows #99", 99)).toBe(false);
		expect(hasClosingTrailer("Closes #1\n\nSee also #99", 99)).toBe(false);
	});

	it("does not match a longer id that merely contains the ticket", () => {
		expect(hasClosingTrailer("Closes #1234", 123)).toBe(false);
		expect(hasClosingTrailer("Closes #12, #1234", 123)).toBe(false);
	});
});

describe("closesTrailerRule", () => {
	it.effect("advises when branch ticket is not closed in body and is open", () =>
		Effect.gen(function* () {
			const hit = yield* closesTrailerRule.check(
				{ message: "subj\n\nbody" },
				{
					branchInfo: { branch: "fix/123-improve", inferredTicketId: 123 },
					openIssues: [{ number: 123, title: "thing" }],
				},
			);
			expect(hit?.severity).toBe("advise");
			expect(hit?.message).toContain("#123");
		}),
	);

	it.effect("returns null when ticket is already closed in body", () =>
		Effect.gen(function* () {
			expect(
				yield* closesTrailerRule.check(
					{ message: "subj\n\nbody\n\nCloses #123" },
					{
						branchInfo: { branch: "fix/123-improve", inferredTicketId: 123 },
						openIssues: [{ number: 123, title: "x" }],
					},
				),
			).toBeNull();
		}),
	);

	it.effect("returns null when no inferred ticket id", () =>
		Effect.gen(function* () {
			expect(
				yield* closesTrailerRule.check(
					{ message: "subj\n\nbody" },
					{
						branchInfo: { branch: "feat/clarity", inferredTicketId: null },
						openIssues: [],
					},
				),
			).toBeNull();
		}),
	);
});
