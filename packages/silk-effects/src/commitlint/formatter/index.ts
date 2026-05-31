/**
 * Custom commitlint formatter with detailed explanations.
 *
 * @remarks
 * This formatter provides enhanced error messages with:
 * - Clear explanations of what went wrong
 * - Suggestions for how to fix the issue
 * - Examples of correct commit messages
 *
 * To use this formatter, set the `formatter` option in your commitlint config
 * or use the `--formatter` CLI flag.
 *
 * @example
 * ```typescript
 * // commitlint.config.ts
 * import { CommitlintConfig } from "@savvy-web/commitlint";
 *
 * export default {
 *   ...CommitlintConfig.silk(),
 *   formatter: "@savvy-web/commitlint/formatter",
 * };
 * ```
 */
export type { FormatterResult, LintOutcome, RuleResult } from "./format.js";
export { format, format as default } from "./format.js";
export { ERROR_EXPLANATIONS, ERROR_SUGGESTIONS, getExplanation, getSuggestion } from "./messages.js";
