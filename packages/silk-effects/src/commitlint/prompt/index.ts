/**
 * Commitizen adapter and prompt configuration module.
 *
 * @remarks
 * This module provides a commitizen-compatible adapter for interactive
 * commit prompts. It includes type definitions, emoji support, and
 * customizable prompt options.
 *
 * @example
 * ```typescript
 * // In package.json:
 * // "config": { "commitizen": { "path": "@savvy-web/commitlint/prompt" } }
 *
 * // Or use the config objects with @commitlint/cz-commitlint:
 * import { createPromptConfig } from "@savvy-web/commitlint/prompt";
 *
 * const config = createPromptConfig({
 *   emojis: true,
 *   scopes: ["api", "cli", "core"],
 * });
 * ```
 */

export type { CommitType } from "../config/rules.js";
export { COMMIT_TYPES } from "../config/rules.js";
export type { PromptConfigOptions, PromptQuestion, ResolvedPromptConfig, TypeEnumEntry } from "./config.js";
export {
	createPromptConfig,
	createTypeEnum,
	defaultPromptConfig,
	defaultPromptConfig as default,
	emojiPromptConfig,
} from "./config.js";
export { TYPE_EMOJIS, TYPE_EMOJIS_UNICODE, getTypeEmoji } from "./emojis.js";
export type { Inquirer, PrompterOptions, Question } from "./prompter.js";
export { prompter } from "./prompter.js";
