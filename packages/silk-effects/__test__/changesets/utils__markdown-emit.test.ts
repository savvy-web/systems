/**
 * Tests for the canonical markdown parse/emit helpers.
 *
 * @remarks
 * `parseKitMarkdown` and `emitKitMarkdown` are the changesets pipeline's
 * markdown boundary, backed by `@effected/markdown`'s canonical stringifier.
 * The canonical form is a stability commitment of that package (changing it is
 * a breaking change there), so these assertions pin bytes deliberately.
 */

import {
	Blockquote,
	Code,
	List,
	ListItem,
	Mdast,
	Paragraph,
	Root,
	Table,
	TableCell,
	TableRow,
	Text,
} from "@effected/markdown";
import { describe, expect, it } from "vitest";

import { emitKitMarkdown, parseKitMarkdown } from "../../src/changesets/utils/markdown-emit.js";

describe("parseKitMarkdown + emitKitMarkdown", () => {
	// The kit parser records author spellings as fidelity fields; the emit
	// boundary must still produce canonical bytes.
	it.each([
		["* alpha\n* beta\n", "- alpha\n- beta\n"],
		["+ a\n", "- a\n"],
		["1) one\n2) two\n", "1. one\n2. two\n"],
		["_em_ and __strong__\n", "*em* and **strong**\n"],
		["~~~ts\nx\n~~~\n", "```ts\nx\n```\n"],
		["a\n\n---\n\nb\n", "a\n\n***\n\nb\n"],
		["Intro.\n\n* alpha\n* beta\n", "Intro.\n\n- alpha\n- beta\n"],
		["Title\n=====\n", "# Title\n"],
	])("canonicalizes %j", (source, expected) => {
		expect(emitKitMarkdown(parseKitMarkdown(source))).toBe(expected);
	});
});

describe("emitKitMarkdown fence policy", () => {
	const item = (text: string): ListItem =>
		new ListItem({ spread: false, children: [new Paragraph({ children: [new Text({ value: text })] })] });

	it("emits a language-less code block fenced regardless of neighbor context", () => {
		// The canonical spelling is neighbor-dependent: standalone lang-less code
		// emits indented, but the same node right after a list takes the
		// serializer's representability escape back to a fence. The fence policy
		// makes both spell identically.
		const afterList = new Root({
			children: [
				new List({ ordered: false, spread: false, children: [item("item")] }),
				new Code({ value: "pnpm add x" }),
			],
		});
		const standalone = new Root({ children: [new Code({ value: "pnpm add x" })] });
		expect(emitKitMarkdown(afterList)).toBe("- item\n\n```\npnpm add x\n```\n");
		expect(emitKitMarkdown(standalone)).toBe("```\npnpm add x\n```\n");
	});

	it("round-trips a language-less fence through parse -> emit unchanged", () => {
		const source = "```\npnpm add x\n```\n";
		expect(emitKitMarkdown(parseKitMarkdown(source))).toBe(source);
	});
});

describe("emitKitMarkdown table cells", () => {
	const table = (cellText: string): Table =>
		new Table({
			children: [
				new TableRow({
					children: [new TableCell({ children: [new Text({ value: cellText, escapeStyle: "literal" })] })],
				}),
			],
		});

	it.each([
		["~0.2.1", "~0.2.1"],
		["a | b", "a \\| b"],
		["**already** `rendered`", "**already** `rendered`"],
	])("emits literal cell text %j verbatim apart from the pipe escape", (cellText, expectedCell) => {
		const emitted = emitKitMarkdown(new Root({ children: [table(cellText)] }));
		expect(emitted).toBe(`| ${expectedCell} |\n| --- |\n`);
	});

	it("recovers a pipe-bearing cell value on reparse", () => {
		const emitted = emitKitMarkdown(new Root({ children: [table("a | b")] }));
		const reparsed = parseKitMarkdown(emitted).children.find((n): n is Table => n.type === "table");
		expect(Mdast.toText(reparsed?.children[0]?.children[0] as TableCell)).toBe("a | b");
	});
});

describe("emitKitMarkdown error path", () => {
	it("throws an Error with the typed cause on a tree nested past the depth cap", () => {
		let node: Blockquote = new Blockquote({ children: [new Paragraph({ children: [new Text({ value: "deep" })] })] });
		for (let i = 0; i < 300; i++) node = new Blockquote({ children: [node] });
		let thrown: unknown;
		try {
			emitKitMarkdown(new Root({ children: [node] }));
		} catch (error) {
			thrown = error;
		}
		expect(thrown).toBeInstanceOf(Error);
		expect((thrown as Error).message).toMatch(/^markdown emit:/);
		expect((thrown as Error).cause).toBeDefined();
	});
});
