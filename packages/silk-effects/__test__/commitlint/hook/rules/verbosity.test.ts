import { Effect } from "effect";
import { describe, expect, it } from "vitest";
import { verbosityRule } from "../../../../src/commitlint/hook/rules/verbosity.js";

const NULL_CTX = {} as never;
const check = (message: string) => Effect.runPromise(verbosityRule.check({ message }, NULL_CTX));

describe("verbosityRule", () => {
	it("advises when body has more than 25 lines", async () => {
		const body = Array(30).fill("body").join("\n");
		const hit = await check(`subject\n\n${body}`);
		expect(hit?.severity).toBe("advise");
		expect(hit?.message).toContain("lines");
	});

	it("advises when body has more than 400 words", async () => {
		const word = "word";
		const body = Array(450).fill(word).join(" ");
		const hit = await check(`subject\n\n${body}`);
		expect(hit?.severity).toBe("advise");
		expect(hit?.message).toContain("words");
	});

	it("returns null for short bodies", async () => {
		expect(await check("subject\n\nshort body")).toBeNull();
	});

	it("counts only body, not subject", async () => {
		const subject = "x".repeat(2000);
		expect(await check(subject)).toBeNull();
	});
});
