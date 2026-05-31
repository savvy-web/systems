import { describe, expect, it } from "vitest";

/**
 * Structural shape tests for commitlint config-integration shims.
 *
 * Each test asserts the ORIGINAL module shape from @savvy-web/commitlint so that
 * a consumer config that referenced the old @savvy-web/commitlint/... subpath
 * works unchanged against @savvy-web/silk/commitlint/....
 */

describe("commitlint shims", () => {
	describe("root (@savvy-web/silk/commitlint)", () => {
		it("exports CommitlintConfig class with static silk() method", async () => {
			const mod = await import("../src/commitlint/index.js");
			expect(mod.CommitlintConfig).toBeDefined();
			expect(typeof mod.CommitlintConfig.silk).toBe("function");
		});

		it("default export is CommitlintConfig", async () => {
			const mod = await import("../src/commitlint/index.js");
			expect(mod.default).toBe(mod.CommitlintConfig);
		});

		it("CommitlintConfig.silk() returns a valid commitlint config object", async () => {
			const mod = await import("../src/commitlint/index.js");
			const config = mod.CommitlintConfig.silk();
			expect(config).toBeTypeOf("object");
			expect(Array.isArray(config.extends)).toBe(true);
			expect(config.rules).toBeTypeOf("object");
		});

		it("exports COMMIT_TYPES array", async () => {
			const mod = await import("../src/commitlint/index.js");
			expect(Array.isArray(mod.COMMIT_TYPES)).toBe(true);
			expect(mod.COMMIT_TYPES.length).toBeGreaterThan(0);
		});

		it("exports COMMIT_TYPE_DEFINITIONS array", async () => {
			const mod = await import("../src/commitlint/index.js");
			expect(Array.isArray(mod.COMMIT_TYPE_DEFINITIONS)).toBe(true);
			expect((mod.COMMIT_TYPE_DEFINITIONS as unknown[]).length).toBeGreaterThan(0);
		});

		it("exports TDD_SCOPE_PATTERN as a RegExp", async () => {
			const mod = await import("../src/commitlint/index.js");
			expect(mod.TDD_SCOPE_PATTERN).toBeInstanceOf(RegExp);
		});

		it("exports TDD_STATES as an array", async () => {
			const mod = await import("../src/commitlint/index.js");
			expect(Array.isArray(mod.TDD_STATES)).toBe(true);
		});
	});

	describe("static (@savvy-web/silk/commitlint/static)", () => {
		it("default export is a valid commitlint config object with extends and rules", async () => {
			const mod = await import("../src/commitlint/static.js");
			const config = mod.default;
			expect(config).toBeTypeOf("object");
			expect(Array.isArray(config.extends)).toBe(true);
			expect((config.extends as string[])[0]).toBe("@commitlint/config-conventional");
			const rules = config.rules as Record<string, unknown>;
			expect(rules).toBeTypeOf("object");
			expect("type-enum" in rules).toBe(true);
			expect("body-max-line-length" in rules).toBe(true);
		});

		it("exports COMMIT_TYPES, COMMIT_TYPE_DEFINITIONS, DEFAULT_BODY_MAX_LINE_LENGTH, DCO_SIGNOFF_TEXT, TDD_SCOPE_PATTERN, TDD_STATES", async () => {
			const mod = await import("../src/commitlint/static.js");
			expect(Array.isArray(mod.COMMIT_TYPES)).toBe(true);
			expect(Array.isArray(mod.COMMIT_TYPE_DEFINITIONS)).toBe(true);
			expect(typeof mod.DEFAULT_BODY_MAX_LINE_LENGTH).toBe("number");
			expect(typeof mod.DCO_SIGNOFF_TEXT).toBe("string");
			expect(mod.TDD_SCOPE_PATTERN).toBeInstanceOf(RegExp);
			expect(Array.isArray(mod.TDD_STATES)).toBe(true);
		});
	});

	describe("prompt (@savvy-web/silk/commitlint/prompt)", () => {
		it("default export is defaultPromptConfig (an object with settings, messages, questions)", async () => {
			const mod = await import("../src/commitlint/prompt.js");
			const config = mod.default;
			expect(config).toBeTypeOf("object");
			expect(config.settings).toBeTypeOf("object");
			expect(typeof config.settings.enableMultipleScopes).toBe("boolean");
			expect(config.messages).toBeTypeOf("object");
			expect(config.questions).toBeTypeOf("object");
			expect(typeof config.questions.type).toBe("object");
		});

		it("named export defaultPromptConfig matches the default export", async () => {
			const mod = await import("../src/commitlint/prompt.js");
			expect(mod.defaultPromptConfig).toBe(mod.default);
		});

		it("exports createPromptConfig as a function", async () => {
			const mod = await import("../src/commitlint/prompt.js");
			expect(typeof mod.createPromptConfig).toBe("function");
		});

		it("exports emojiPromptConfig with questions.type.enum entries", async () => {
			const mod = await import("../src/commitlint/prompt.js");
			expect(mod.emojiPromptConfig).toBeTypeOf("object");
			expect(mod.emojiPromptConfig.questions.type.enum).toBeTypeOf("object");
		});

		it("exports prompter as a function", async () => {
			const mod = await import("../src/commitlint/prompt.js");
			expect(typeof mod.prompter).toBe("function");
		});

		it("exports TYPE_EMOJIS as an object and getTypeEmoji as a function", async () => {
			const mod = await import("../src/commitlint/prompt.js");
			expect(mod.TYPE_EMOJIS).toBeTypeOf("object");
			expect(typeof mod.getTypeEmoji).toBe("function");
		});

		it("exports COMMIT_TYPES array", async () => {
			const mod = await import("../src/commitlint/prompt.js");
			expect(Array.isArray(mod.COMMIT_TYPES)).toBe(true);
		});
	});

	describe("formatter (@savvy-web/silk/commitlint/formatter)", () => {
		it("default export is the format function", async () => {
			const mod = await import("../src/commitlint/formatter.js");
			expect(typeof mod.default).toBe("function");
		});

		it("named export format is also a function (same as default)", async () => {
			const mod = await import("../src/commitlint/formatter.js");
			expect(typeof mod.format).toBe("function");
			expect(mod.format).toBe(mod.default);
		});

		it("exports ERROR_EXPLANATIONS as an object", async () => {
			const mod = await import("../src/commitlint/formatter.js");
			expect(mod.ERROR_EXPLANATIONS).toBeTypeOf("object");
		});

		it("exports ERROR_SUGGESTIONS as an object", async () => {
			const mod = await import("../src/commitlint/formatter.js");
			expect(mod.ERROR_SUGGESTIONS).toBeTypeOf("object");
		});

		it("exports getExplanation and getSuggestion as functions", async () => {
			const mod = await import("../src/commitlint/formatter.js");
			expect(typeof mod.getExplanation).toBe("function");
			expect(typeof mod.getSuggestion).toBe("function");
		});
	});
});
