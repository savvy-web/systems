import { describe, expect, it } from "vitest";
import { COMMIT_TYPES } from "../../../src/commitlint/config/rules.js";
import { TYPE_EMOJIS, TYPE_EMOJIS_UNICODE, getTypeEmoji } from "../../../src/commitlint/prompt/emojis.js";

describe("getTypeEmoji", () => {
	it("returns shortcode emoji by default", () => {
		expect(getTypeEmoji("feat")).toBe(":sparkles:");
	});

	it("returns unicode emoji when unicode flag is true", () => {
		expect(getTypeEmoji("feat", true)).toBe("\u2728");
	});

	it("has emoji mappings for all commit types", () => {
		for (const type of COMMIT_TYPES) {
			expect(TYPE_EMOJIS[type]).toBeDefined();
			expect(TYPE_EMOJIS_UNICODE[type]).toBeDefined();
		}
	});
});
