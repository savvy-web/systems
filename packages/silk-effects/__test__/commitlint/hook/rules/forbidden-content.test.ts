import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import { forbiddenContentRule } from "../../../../src/commitlint/hook/rules/forbidden-content.js";

const NULL_CTX = {} as never;

function check(message: string) {
	return forbiddenContentRule.check({ message }, NULL_CTX);
}

describe("forbiddenContentRule", () => {
	it.effect("denies a body containing a markdown header", () =>
		Effect.gen(function* () {
			const hit = yield* check("subject\n\n# Header\n\nbody");
			expect(hit?.severity).toBe("deny");
			expect(hit?.message).toContain("markdown header");
		}),
	);

	it.effect("denies a body containing a code fence", () =>
		Effect.gen(function* () {
			const hit = yield* check("subject\n\nbody\n\n```ts\nfoo()\n```\n");
			expect(hit?.severity).toBe("deny");
			expect(hit?.message).toContain("code fence");
		}),
	);

	it.effect("returns null for clean messages", () =>
		Effect.gen(function* () {
			const hit = yield* check("subject\n\nbody line 1\n- bullet point\n");
			expect(hit).toBeNull();
		}),
	);

	it.effect("does not flag # appearing inside a sentence", () =>
		Effect.gen(function* () {
			const hit = yield* check("subject\n\nfix issue numbered #42 in the body");
			expect(hit).toBeNull();
		}),
	);
});
