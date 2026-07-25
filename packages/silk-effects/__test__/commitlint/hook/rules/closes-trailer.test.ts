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

	it("does not match the verb 'close' (only closes/fixes/resolves)", () => {
		expect(hasClosingTrailer("close #123", 123)).toBe(false);
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
