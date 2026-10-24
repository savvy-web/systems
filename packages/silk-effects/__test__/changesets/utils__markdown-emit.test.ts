/**
 * Tests for the canonical markdown parse/emit helpers.
 *
 * @remarks
 * `parseKitMarkdown` and `emitKitMarkdown` are the changesets pipeline's
 * markdown boundary, backed by `@effected/markdown`'s canonical stringifier.
 * The canonical form is a stability commitment of that package (changing it is
 * a breaking change there), so these assertions pin bytes deliberately.
 */

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
