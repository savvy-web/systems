// packages/api-extractor-llms/__test__/formatter.test.ts
import { describe, expect, it } from "vitest";

import { TypeSignatureFormatter } from "../src/formatter.js";

// Minimal Excerpt-shaped fixture: { text, spannedTokens: [{ text }] }.
const excerpt = (tokens: string[]) => ({
	text: tokens.join(""),
	spannedTokens: tokens.map((t) => ({ text: t })),
});

describe("TypeSignatureFormatter", () => {
	const fmt = new TypeSignatureFormatter();

	it("strips export/declare from the leading token", () => {
		expect(fmt.format(excerpt(["export declare function ", "foo", "(): ", "void"]) as never)).toBe(
			"function foo(): void",
		);
	});

	it("falls back to stripped text when there are no spanned tokens", () => {
		expect(fmt.format({ text: "export declare const x: number", spannedTokens: [] } as never)).toBe("const x: number");
	});

	it("wraps a long union type across lines after a | operator", () => {
		const tokens = [
			"export declare type ",
			"LongName",
			" = ",
			"VeryLongTypeName",
			" | ",
			"AnotherVeryLongTypeName",
			" | ",
			"YetAnotherLongTypeName",
		];
		const result = new TypeSignatureFormatter({ maxLineLength: 30 }).format(excerpt(tokens) as never);
		expect(result).toContain("\n");
		expect(result).toMatch(/^\s+/m); // continuation line is indented
	});
});
