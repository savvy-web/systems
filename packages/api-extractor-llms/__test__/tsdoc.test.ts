import { describe, expect, it } from "vitest";

import { extractPlainText } from "../src/tsdoc.js";

// extractPlainText walks any node exposing { kind, getChildNodes } or leaf text.
const plain = (text: string) => ({ kind: "PlainText", text });
const code = (c: string) => ({ kind: "CodeSpan", code: c });
const section = (children: unknown[]) => ({
	kind: "Section",
	getChildNodes: () => children,
});

describe("extractPlainText", () => {
	it("renders plain text leaves", () => {
		expect(extractPlainText(plain("hello") as never)).toBe("hello");
	});

	it("wraps code spans in backticks", () => {
		expect(extractPlainText(code("Foo") as never)).toBe("`Foo`");
	});

	it("concatenates children of a section node", () => {
		const node = section([plain("a "), code("B"), plain(" c")]);
		expect(extractPlainText(node as never)).toBe("a `B` c");
	});

	it("renders a soft break as a single space", () => {
		expect(extractPlainText({ kind: "SoftBreak" } as never)).toBe(" ");
	});
});
