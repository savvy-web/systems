/**
 * Emoji definitions for commit types.
 *
 * @internal
 */
import type { CommitType } from "../config/rules.js";

/**
 * Emoji shortcode mapping for commit types.
 *
 * @remarks
 * Uses GitHub/GitLab compatible shortcodes (e.g., `:sparkles:`) that
 * render as emojis in Markdown contexts and web UIs.
 *
 * @public
 */
export const TYPE_EMOJIS: Record<CommitType, string> = {
	ai: ":robot:",
	feat: ":sparkles:",
	fix: ":bug:",
	docs: ":memo:",
	style: ":lipstick:",
	refactor: ":recycle:",
	perf: ":zap:",
	test: ":white_check_mark:",
	tdd: ":test_tube:",
	build: ":package:",
	ci: ":construction_worker:",
	chore: ":wrench:",
	revert: ":rewind:",
	release: ":bookmark:",
} as const;

/**
 * Unicode emoji mapping for commit types.
 *
 * @remarks
 * Uses actual Unicode emojis for terminals and contexts that
 * support direct emoji rendering.
 *
 * @public
 */
export const TYPE_EMOJIS_UNICODE: Record<CommitType, string> = {
	ai: "\uD83E\uDD16", // robot
	feat: "\u2728", // sparkles
	fix: "\uD83D\uDC1B", // bug
	docs: "\uD83D\uDCDD", // memo
	style: "\uD83D\uDC84", // lipstick
	refactor: "\u267B\uFE0F", // recycle
	perf: "\u26A1", // zap
	test: "\u2705", // white_check_mark
	tdd: "\uD83E\uDEEA", // test_tube
	build: "\uD83D\uDCE6", // package
	ci: "\uD83D\uDC77", // construction_worker
	chore: "\uD83D\uDD27", // wrench
	revert: "\u23EA", // rewind
	release: "\uD83D\uDD16", // bookmark
} as const;

/**
 * Get emoji for a commit type.
 *
 * @param type - Commit type
 * @param unicode - Use Unicode emojis instead of shortcodes
 * @returns Emoji string (shortcode or Unicode)
 *
 * @public
 *
 * @example
 * ```typescript
 * import { getTypeEmoji } from "@savvy-web/commitlint/prompt";
 *
 * getTypeEmoji("feat");        // ":sparkles:"
 * getTypeEmoji("feat", true);  // "✨"
 * ```
 */
export function getTypeEmoji(type: CommitType, unicode = false): string {
	return unicode ? TYPE_EMOJIS_UNICODE[type] : TYPE_EMOJIS[type];
}
