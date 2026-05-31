import { describe, expect, it } from "vitest";
import { COMMIT_TYPES } from "../../../src/commitlint/config/rules.js";
import {
	createPromptConfig,
	createTypeEnum,
	defaultPromptConfig,
	emojiPromptConfig,
} from "../../../src/commitlint/prompt/config.js";
import { TYPE_EMOJIS } from "../../../src/commitlint/prompt/emojis.js";

describe("createTypeEnum", () => {
	it("creates type enum without emojis", () => {
		const typeEnum = createTypeEnum(false);

		expect(Object.keys(typeEnum)).toHaveLength(COMMIT_TYPES.length);

		for (const type of COMMIT_TYPES) {
			expect(typeEnum[type]).toBeDefined();
			expect(typeEnum[type].emoji).toBe("");
			expect(typeEnum[type].description).toBeTruthy();
			expect(typeEnum[type].title).toBeTruthy();
		}
	});

	it("creates type enum with emojis", () => {
		const typeEnum = createTypeEnum(true);

		for (const type of COMMIT_TYPES) {
			expect(typeEnum[type].emoji).toBe(TYPE_EMOJIS[type]);
		}
	});
});

describe("createPromptConfig", () => {
	it("creates default prompt config", () => {
		const config = createPromptConfig();

		expect(config.settings.enableMultipleScopes).toBe(true);
		expect(config.settings.scopeEnumSeparator).toBe(",");
		expect(config.messages).toBeDefined();
		expect(config.questions.type).toBeDefined();
		expect(config.questions.scope).toBeDefined();
		expect(config.questions.subject).toBeDefined();
	});

	it("includes emojis when enabled", () => {
		const config = createPromptConfig({ emojis: true });

		expect(config.questions.type.enum.feat.emoji).toBe(TYPE_EMOJIS.feat);
	});

	it("does not include emojis by default", () => {
		const config = createPromptConfig();

		expect(config.questions.type.enum.feat.emoji).toBe("");
	});

	it("includes scope enum when scopes provided", () => {
		const config = createPromptConfig({ scopes: ["api", "cli"] });

		expect(config.questions.scope.enum).toEqual(["api", "cli"]);
	});
});

describe("defaultPromptConfig", () => {
	it("has no emojis", () => {
		expect(defaultPromptConfig.questions.type.enum.feat.emoji).toBe("");
	});
});

describe("emojiPromptConfig", () => {
	it("has emojis", () => {
		expect(emojiPromptConfig.questions.type.enum.feat.emoji).toBe(TYPE_EMOJIS.feat);
	});
});
