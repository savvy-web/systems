import { describe, expect, it } from "vitest";
import { createMessageSuppressor } from "../../src/meta/message-suppressor.js";

describe("createMessageSuppressor", () => {
	it("matches by messageId and regex pattern (AND)", () => {
		const s = createMessageSuppressor([{ messageId: "ae-forgotten-export", pattern: "_base" }]);
		expect(s.matches("ae-forgotten-export", 'The symbol "Foo_base" needs to be exported')).toBe(true);
		expect(s.matches("ae-forgotten-export", 'The symbol "Foo" needs to be exported')).toBe(false);
		expect(s.matches("ae-other", "Foo_base")).toBe(false);
	});

	it("falls back to substring when the pattern is not a valid regex", () => {
		const s = createMessageSuppressor([{ messageId: "x", pattern: "a[b" }]);
		expect(s.matches("x", "literal a[b here")).toBe(true);
		expect(s.matches("x", "no match")).toBe(false);
	});

	it("matches on messageId alone when no pattern is given", () => {
		const s = createMessageSuppressor([{ messageId: "ae-forgotten-export" }]);
		expect(s.matches("ae-forgotten-export", "anything")).toBe(true);
	});
});
