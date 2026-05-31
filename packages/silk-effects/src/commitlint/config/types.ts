/**
 * TypeScript type definitions for commitlint configuration.
 *
 * @internal
 */
/**
 * Rule severity level.
 * - 0: Disabled
 * - 1: Warning
 * - 2: Error
 *
 * @public
 */
export type RuleSeverity = 0 | 1 | 2;

/**
 * Rule applicability.
 *
 * @public
 */
export type RuleApplicability = "always" | "never";

/**
 * Rule configuration tuple.
 *
 * @public
 */
export type RuleConfigTuple<T = unknown> =
	| readonly [RuleSeverity]
	| readonly [RuleSeverity, RuleApplicability]
	| readonly [RuleSeverity, RuleApplicability, T];

/**
 * Commitlint rules configuration.
 *
 * @public
 */
export interface RulesConfig {
	[ruleName: string]: RuleConfigTuple | undefined;
}

/**
 * Commitlint prompt settings.
 *
 * @public
 */
export interface PromptSettings {
	enableMultipleScopes?: boolean;
	scopeEnumSeparator?: string;
}

/**
 * Commitlint prompt configuration.
 *
 * @public
 */
export interface PromptConfig {
	settings?: PromptSettings;
	messages?: Record<string, string>;
	questions?: Record<string, unknown>;
}

/**
 * Commitlint plugin interface.
 *
 * @public
 */
export interface CommitlintPlugin {
	// biome-ignore lint/suspicious/noExplicitAny: Plugin rules have complex signatures
	rules?: Record<string, any>;
}

/**
 * Commitlint user configuration.
 *
 * @remarks
 * Simplified type that captures the configuration shape used by this package.
 * Compatible with `@commitlint/types` UserConfig.
 *
 * @public
 */
export interface CommitlintUserConfig {
	/** Configurations to extend */
	extends?: string[];
	/** Plugins to load */
	plugins?: (string | CommitlintPlugin)[];
	/** Rule configurations */
	rules?: RulesConfig;
	/** Prompt configuration for interactive commits */
	prompt?: PromptConfig;
	/** Parser preset */
	parserPreset?: string | Record<string, unknown>;
	/** Formatter for output */
	formatter?: string;
	/** Help URL for errors */
	helpUrl?: string;
}

/**
 * Commit type definition with metadata for prompts and documentation.
 *
 * @remarks
 * Each commit type has associated metadata used by interactive prompts
 * and changelog generation.
 *
 * @public
 */
export interface CommitTypeDefinition {
	/**
	 * Type identifier used in commit messages.
	 *
	 * @example "feat", "fix", "docs"
	 */
	readonly type: string;

	/**
	 * Human-readable description of when to use this type.
	 */
	readonly description: string;

	/**
	 * Title for display in prompts and changelogs.
	 */
	readonly title: string;

	/**
	 * Optional emoji shortcode for the type.
	 *
	 * @remarks
	 * When provided, uses GitHub/GitLab compatible shortcodes (e.g., `:sparkles:`).
	 */
	readonly emoji?: string;
}

/**
 * Rule configuration tuple format used by commitlint.
 *
 * @typeParam T - The type of the rule value (varies by rule)
 *
 * @public
 */
export type RuleConfig<T = unknown> = readonly [RuleSeverity, RuleApplicability, T];
