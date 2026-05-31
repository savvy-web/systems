import { describe, expect, it } from "vitest";
import defaultExport, {
	ERROR_EXPLANATIONS,
	ERROR_SUGGESTIONS,
	format,
	getExplanation,
	getSuggestion,
} from "../../../src/commitlint/formatter/index.js";

describe("formatter barrel exports", () => {
	it("exports format function", () => {
		expect(typeof format).toBe("function");
	});

	it("exports format as default export", () => {
		expect(defaultExport).toBe(format);
	});

	it("exports ERROR_EXPLANATIONS", () => {
		expect(ERROR_EXPLANATIONS).toBeDefined();
		expect(typeof ERROR_EXPLANATIONS).toBe("object");
	});

	it("exports ERROR_SUGGESTIONS", () => {
		expect(ERROR_SUGGESTIONS).toBeDefined();
		expect(typeof ERROR_SUGGESTIONS).toBe("object");
	});

	it("exports getExplanation function", () => {
		expect(typeof getExplanation).toBe("function");
	});

	it("exports getSuggestion function", () => {
		expect(typeof getSuggestion).toBe("function");
	});
});
