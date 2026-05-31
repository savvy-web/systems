/**
 * Prompt configuration for commitizen adapters.
 *
 * @remarks
 * This module provides prompt configurations compatible with both the
 * built-in prompter and `@commitlint/cz-commitlint`.
 *
 * @internal
 */
import type { CommitType } from "../config/rules.js";
import { COMMIT_TYPE_DEFINITIONS } from "../config/rules.js";
import { TYPE_EMOJIS } from "./emojis.js";

/**
 * Type enum entry for prompt configuration.
 *
 * @remarks
 * Represents a single commit type option in the interactive prompt.
 *
 * @public
 */
export interface TypeEnumEntry {
	/** Human-readable description of the type */
	description: string;

	/** Title for display in changelogs */
	title: string;

	/** Emoji shortcode (empty string if emojis disabled) */
	emoji: string;
}

/**
 * Question definition for the prompt configuration.
 *
 * @public
 */
export interface PromptQuestion {
	/** Human-readable prompt description */
	description: string;

	/** Enum restriction for values (type enum or scope list) */
	enum?: Record<CommitType, TypeEnumEntry> | string[];
}

/**
 * Resolved prompt configuration returned by {@link createPromptConfig}.
 *
 * @remarks
 * This is the fully-resolved shape with all fields populated.
 * Compatible with commitlint's `PromptConfig` interface.
 *
 * @public
 */
export interface ResolvedPromptConfig {
	/** Prompt settings for scope behavior */
	settings: {
		enableMultipleScopes: boolean;
		scopeEnumSeparator: string;
	};

	/** Human-readable prompt messages */
	messages: Record<string, string>;

	/** Question definitions keyed by question name */
	questions: {
		type: { description: string; enum: Record<CommitType, TypeEnumEntry> };
		scope: { description: string; enum?: string[] };
		subject: { description: string };
		body: { description: string };
		isBreaking: { description: string };
		breakingBody: { description: string };
		isIssueAffected: { description: string };
		issuesBody: { description: string };
	};
}

/**
 * Options for creating a prompt configuration.
 *
 * @public
 */
export interface PromptConfigOptions {
	/**
	 * Enable emojis in type descriptions.
	 *
	 * @defaultValue false
	 */
	emojis?: boolean;

	/**
	 * Custom scopes to show in the scope selection prompt.
	 *
	 * @remarks
	 * When provided, creates an enum restriction for the scope question.
	 */
	scopes?: string[];
}

/**
 * Create type enum configuration for prompts.
 *
 * @remarks
 * Builds the type enum object used by commitizen adapters
 * to display commit type options in the interactive prompt.
 *
 * @param emojis - Whether to include emoji shortcodes
 * @returns Type enum configuration object
 *
 * @public
 */
export function createTypeEnum(emojis: boolean): Record<CommitType, TypeEnumEntry> {
	const typeEnum: Record<string, TypeEnumEntry> = {};

	for (const def of COMMIT_TYPE_DEFINITIONS) {
		typeEnum[def.type] = {
			description: def.description,
			title: def.title,
			emoji: emojis ? TYPE_EMOJIS[def.type as CommitType] : "",
		};
	}

	return typeEnum as Record<CommitType, TypeEnumEntry>;
}

/**
 * Create prompt configuration for commitizen adapters.
 *
 * @remarks
 * Generates a complete prompt configuration object compatible with
 * `@commitlint/cz-commitlint` and included in `CommitlintConfig.silk()` output.
 *
 * @param options - Prompt configuration options
 * @returns Prompt configuration object
 *
 * @public
 *
 * @example
 * ```typescript
 * import { createPromptConfig } from "@savvy-web/commitlint/prompt";
 *
 * const promptConfig = createPromptConfig({ emojis: true });
 * ```
 */
export function createPromptConfig(options: PromptConfigOptions = {}): ResolvedPromptConfig {
	const { emojis = false, scopes } = options;

	const scopeQuestion: { description: string; enum?: string[] } = {
		description: "What is the scope of this change (e.g., component name):",
	};

	if (scopes && scopes.length > 0) {
		scopeQuestion.enum = scopes;
	}

	return {
		settings: {
			enableMultipleScopes: true,
			scopeEnumSeparator: ",",
		},
		messages: {
			skip: "(press enter to skip)",
			max: "(max %d chars)",
			min: "(min %d chars)",
			emptyWarning: "cannot be empty",
			upperLimitWarning: "over the limit",
			lowerLimitWarning: "below the limit",
		},
		questions: {
			type: {
				description: "Select the type of change you're committing:",
				enum: createTypeEnum(emojis),
			},
			scope: scopeQuestion,
			subject: {
				description: "Write a short, imperative description of the change:",
			},
			body: {
				description: "Provide a longer description of the change (optional):",
			},
			isBreaking: {
				description: "Are there any breaking changes?",
			},
			breakingBody: {
				description: "Describe the breaking changes:",
			},
			isIssueAffected: {
				description: "Does this change affect any open issues?",
			},
			issuesBody: {
				description: "Add issue references (e.g., 'fix #123', 'close #456'):",
			},
		},
	};
}

/**
 * Default prompt configuration (no emojis).
 *
 * @public
 */
export const defaultPromptConfig = createPromptConfig();

/**
 * Prompt configuration with emojis enabled.
 *
 * @public
 */
export const emojiPromptConfig = createPromptConfig({ emojis: true });
