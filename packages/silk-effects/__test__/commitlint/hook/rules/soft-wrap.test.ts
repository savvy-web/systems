import { Effect } from "effect";
import { describe, expect, it } from "vitest";
import { softWrapRule } from "../../../../src/commitlint/hook/rules/soft-wrap.js";

const NULL_CTX = {} as never;
const check = (message: string) => Effect.runPromise(softWrapRule.check({ message }, NULL_CTX));

describe("softWrapRule", () => {
	it("advises on a bullet that has a continuation line < 80 chars without a bullet prefix", async () => {
		const msg = ["subject", "", "- this bullet wraps", "  unnecessarily across two lines"].join("\n");
		const hit = await check(msg);
		expect(hit?.severity).toBe("advise");
		expect(hit?.message).toContain("soft-wrap");
	});

	it("does not flag a bullet whose continuation is the start of a new bullet", async () => {
		const msg = ["subject", "", "- bullet one is short", "- bullet two is also short"].join("\n");
		expect(await check(msg)).toBeNull();
	});

	it("does not flag a single-line bullet that is over 80 chars", async () => {
		const msg = `subject\n\n- ${"x".repeat(150)}\n`;
		expect(await check(msg)).toBeNull();
	});

	it("does not flag prose paragraphs", async () => {
		expect(await check("subj\n\nfirst paragraph\n\nsecond paragraph")).toBeNull();
	});
});
