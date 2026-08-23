/**
 * Tests for the canonical markdown emit helper.
 *
 * @remarks
 * `emitMarkdown` is the changesets pipeline's single markdown EMIT boundary,
 * backed by `@effected/markdown`'s canonical stringifier. The canonical form
 * is a stability commitment of that package (changing it is a breaking change
 * there), so these assertions pin bytes deliberately.
 */

import type { Root } from "mdast";
import { describe, expect, it } from "vitest";

import { emitMarkdown } from "../../src/changesets/utils/markdown-emit.js";
import { parseMarkdown } from "../../src/changesets/utils/remark-pipeline.js";

describe("emitMarkdown", () => {
	it("emits the kit's canonical form for a synthesized tree", () => {
		const tree: Root = {
			type: "root",
			children: [
				{ type: "heading", depth: 2, children: [{ type: "text", value: "Patch Changes" }] },
				{
					type: "list",
					ordered: false,
					spread: false,
					children: [
						{
							type: "listItem",
							spread: false,
							children: [{ type: "paragraph", children: [{ type: "text", value: "a bullet" }] }],
						},
					],
				},
				{
					type: "paragraph",
					children: [
						{ type: "emphasis", children: [{ type: "text", value: "em" }] },
						{ type: "text", value: " and " },
						{ type: "strong", children: [{ type: "text", value: "st" }] },
					],
				},
				{ type: "thematicBreak" },
			],
		};
		expect(emitMarkdown(tree)).toBe("## Patch Changes\n\n- a bullet\n\n*em* and **st**\n\n***\n");
	});

	it("round-trips a parsed document through parse -> emit -> parse structurally", () => {
		const source = "## Features\n\n- one\n- two\n\n| A | B |\n| --- | --- |\n| 1 | 2 |\n";
		const emitted = emitMarkdown(parseMarkdown(source));
		const again = emitMarkdown(parseMarkdown(emitted));
		expect(again).toBe(emitted);
	});

	it("emits GFM tables with escaped-but-recoverable cell text", () => {
		const tree: Root = {
			type: "root",
			children: [
				{
					type: "table",
					children: [
						{
							type: "tableRow",
							children: [{ type: "tableCell", children: [{ type: "text", value: "~0.2.1" }] }],
						},
					],
				},
			],
		};
		const emitted = emitMarkdown(tree);
		// The canonical stringifier escapes `~` in inline text; parsing consumes
		// the escape, so the value survives a round trip untouched.
		expect(emitted).toContain("\\~0.2.1");
		const reparsed = parseMarkdown(emitted);
		expect(JSON.stringify(reparsed)).toContain('"~0.2.1"');
	});

	it("keeps language-less code blocks fenced (house policy over the canonical indented default)", () => {
		// The canonical default emits a code node with neither `lang` nor
		// `fenceChar` as an INDENTED block; changelog content must stay fenced,
		// so the emit helper defaults `fenceChar` on such nodes — including
		// nested ones — before stringifying.
		const tree: Root = {
			type: "root",
			children: [
				{ type: "code", lang: null, value: "pnpm add x" },
				{ type: "code", lang: "bash", value: "pnpm add y" },
				{
					type: "blockquote",
					children: [{ type: "code", value: "nested" }],
				},
			],
		};
		const emitted = emitMarkdown(tree);
		expect(emitted).toContain("```\npnpm add x\n```");
		expect(emitted).toContain("```bash\npnpm add y\n```");
		expect(emitted).not.toMatch(/^ {4}/m);
	});

	it("emits a language-less code block fenced regardless of neighbor context", () => {
		// Without the fence policy the canonical spelling is neighbor-dependent:
		// standalone lang-less code emits indented, but the same node right
		// after a list takes the serializer's representability escape back to a
		// fence. The policy makes both spell identically.
		const afterList: Root = {
			type: "root",
			children: [
				{
					type: "list",
					ordered: false,
					spread: false,
					children: [
						{
							type: "listItem",
							spread: false,
							children: [{ type: "paragraph", children: [{ type: "text", value: "item" }] }],
						},
					],
				},
				{ type: "code", lang: null, value: "pnpm add x" },
			],
		};
		const standalone: Root = { type: "root", children: [{ type: "code", lang: null, value: "pnpm add x" }] };
		expect(emitMarkdown(afterList)).toBe("- item\n\n```\npnpm add x\n```\n");
		expect(emitMarkdown(standalone)).toBe("```\npnpm add x\n```\n");
	});

	it("round-trips a language-less fence through parse -> emit unchanged", () => {
		const source = "```\npnpm add x\n```\n";
		expect(emitMarkdown(parseMarkdown(source))).toBe(source);
	});

	it("throws a defect with the typed error's context on an undecodable tree", () => {
		const bogus = { type: "root", children: [{ type: "not-a-node" }] } as unknown as Root;
		expect(() => emitMarkdown(bogus)).toThrow(/markdown/i);
	});
});
