import { describe, expect, it } from "vitest";
import defaultExport, {
	COMMIT_TYPES,
	TYPE_EMOJIS,
	TYPE_EMOJIS_UNICODE,
	createPromptConfig,
	createTypeEnum,
	defaultPromptConfig,
	emojiPromptConfig,
	getTypeEmoji,
	prompter,
} from "../../../src/commitlint/prompt/index.js";

describe("prompt barrel exports", () => {
	it("exports COMMIT_TYPES", () => {
		expect(Array.isArray(COMMIT_TYPES)).toBe(true);
	});

	it("exports createPromptConfig function", () => {
		expect(typeof createPromptConfig).toBe("function");
	});

	it("exports createTypeEnum function", () => {
		expect(typeof createTypeEnum).toBe("function");
	});

	it("exports defaultPromptConfig", () => {
		expect(defaultPromptConfig).toBeDefined();
	});

	it("exports defaultPromptConfig as default export", () => {
		expect(defaultExport).toBe(defaultPromptConfig);
	});

	it("exports emojiPromptConfig", () => {
		expect(emojiPromptConfig).toBeDefined();
	});

	it("exports TYPE_EMOJIS", () => {
		expect(TYPE_EMOJIS).toBeDefined();
	});

	it("exports TYPE_EMOJIS_UNICODE", () => {
		expect(TYPE_EMOJIS_UNICODE).toBeDefined();
	});

	it("exports getTypeEmoji function", () => {
		expect(typeof getTypeEmoji).toBe("function");
	});

	it("exports prompter function", () => {
		expect(typeof prompter).toBe("function");
	});
});
