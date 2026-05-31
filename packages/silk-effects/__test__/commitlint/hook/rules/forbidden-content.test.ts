import { Effect } from "effect";
import { describe, expect, it } from "vitest";
import { forbiddenContentRule } from "../../../../src/commitlint/hook/rules/forbidden-content.js";

const NULL_CTX = {} as never;

async function check(message: string) {
	return Effect.runPromise(forbiddenContentRule.check({ message }, NULL_CTX));
}

describe("forbiddenContentRule", () => {
	it("denies a body containing a markdown header", async () => {
		const hit = await check("subject\n\n# Header\n\nbody");
		expect(hit?.severity).toBe("deny");
		expect(hit?.message).toContain("markdown header");
	});

	it("denies a body containing a code fence", async () => {
		const hit = await check("subject\n\nbody\n\n```ts\nfoo()\n```\n");
		expect(hit?.severity).toBe("deny");
		expect(hit?.message).toContain("code fence");
	});

	it("returns null for clean messages", async () => {
		const hit = await check("subject\n\nbody line 1\n- bullet point\n");
		expect(hit).toBeNull();
	});

	it("does not flag # appearing inside a sentence", async () => {
		const hit = await check("subject\n\nfix issue numbered #42 in the body");
		expect(hit).toBeNull();
	});
});
