/**
 * Static commitlint configuration (no auto-detection).
 *
 * @remarks
 * Use this export when you don't need auto-detection features
 * and want a simple, static configuration. This is useful for:
 * - Projects that don't use workspaces
 * - CI environments where detection overhead is unwanted
 * - Cases where you want deterministic, unchanging configuration
 *
 * @example
 * ```typescript
 * // commitlint.config.ts
 * export { default } from "@savvy-web/commitlint/static";
 * ```
 *
 * @example
 * ```typescript
 * // With overrides
 * import config from "@savvy-web/commitlint/static";
 *
 * export default {
 *   ...config,
 *   rules: {
 *     ...config.rules,
 *     "scope-enum": [2, "always", ["api", "cli", "core"]],
 *   },
 * };
 * ```
 */
import { silkPlugin } from "./config/plugins.js";
import { COMMIT_TYPES, DEFAULT_BODY_MAX_LINE_LENGTH } from "./config/rules.js";
import type { CommitlintUserConfig } from "./config/types.js";

/**
 * Static commitlint configuration.
 *
 * @remarks
 * This configuration includes:
 * - Extended type enum with `ai` and `release` types
 * - Body max line length of 300 characters
 * - DCO signoff requirement
 * - Multiple scope support enabled
 * - Subject case rule disabled (allows AI-capitalized subjects)
 *
 * @public
 */
const staticConfig: CommitlintUserConfig = {
	extends: ["@commitlint/config-conventional"],
	plugins: [silkPlugin],
	rules: {
		"body-max-line-length": [2, "always", DEFAULT_BODY_MAX_LINE_LENGTH],
		"type-enum": [2, "always", [...COMMIT_TYPES]],
		// Use custom case-insensitive rule instead of built-in signed-off-by
		"silk/signed-off-by": [2, "always"],
		"silk/tdd-scope": [2, "always"],
		// Allow any case in subject (AI tools often capitalize, which is acceptable)
		"subject-case": [0],
	},
	prompt: {
		settings: {
			enableMultipleScopes: true,
			scopeEnumSeparator: ",",
		},
	},
};

export default staticConfig;

export type { CommitType } from "./config/rules.js";
// Re-export useful constants for manual configuration
export {
	COMMIT_TYPES,
	COMMIT_TYPE_DEFINITIONS,
	DCO_SIGNOFF_TEXT,
	DEFAULT_BODY_MAX_LINE_LENGTH,
	TDD_SCOPE_PATTERN,
	TDD_STATES,
} from "./config/rules.js";
// Re-export types for public API
export type {
	CommitTypeDefinition,
	CommitlintPlugin,
	CommitlintUserConfig,
	PromptConfig,
	PromptSettings,
	RuleApplicability,
	RuleConfigTuple,
	RuleSeverity,
	RulesConfig,
} from "./config/types.js";
