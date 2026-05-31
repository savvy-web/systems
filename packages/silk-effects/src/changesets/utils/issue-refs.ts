/**
 * GitHub issue reference parsing from commit messages.
 *
 * @remarks
 * Extracts categorized issue references (`Closes`, `Fixes`, `Refs`) from
 * commit message bodies. Supports multiple formats including with/without
 * colons, singular/plural keywords, and comma-separated issue lists.
 * Input is truncated to 10,000 characters to prevent ReDoS on adversarial input.
 *
 * @see {@link Changelog} for the public API that consumes issue references
 *
 * @internal
 */

/**
 * Matches "closes #123" or "close: #456, #789" patterns (case-insensitive).
 *
 * Capture group `[1]` contains the comma-separated issue number list.
 *
 * @internal
 */
const CLOSES_ISSUE_PATTERN = /closes?:?\s*#?(\d+(?:, *#?\d+)*)/i;

/**
 * Matches "fixes #123" or "fix: #456, #789" patterns (case-insensitive).
 *
 * Capture group `[1]` contains the comma-separated issue number list.
 *
 * @internal
 */
const FIXES_ISSUE_PATTERN = /fix(?:es)?:?\s*#?(\d+(?:, *#?\d+)*)/i;

/**
 * Matches "refs #123" or "ref: #456, #789" patterns (case-insensitive).
 *
 * Capture group `[1]` contains the comma-separated issue number list.
 *
 * @internal
 */
const REFS_ISSUE_PATTERN = /refs?:?\s*#?(\d+(?:, *#?\d+)*)/i;

/**
 * Pattern for splitting comma-separated issue numbers.
 *
 * @internal
 */
const ISSUE_NUMBER_SPLIT_PATTERN = /, */;

/**
 * Categorized issue references extracted from a commit message.
 *
 * @remarks
 * Each category corresponds to a GitHub keyword that can automatically
 * close or reference issues when used in commit messages or PR descriptions.
 * Issue numbers are stored as strings without the `#` prefix.
 *
 * @example
 * ```typescript
 * import type { IssueReferences } from "../utils/issue-refs.js";
 *
 * const refs: IssueReferences = {
 *   closes: ["42"],
 *   fixes: ["17", "23"],
 *   refs: ["100"],
 * };
 * ```
 *
 * @internal
 */
export interface IssueReferences {
	/** Issue numbers closed by this commit. */
	closes: string[];
	/** Issue numbers for bugs fixed by this commit. */
	fixes: string[];
	/** Issue numbers referenced but not closed. */
	refs: string[];
}

/**
 * Extract issue numbers from a regex match against a commit message.
 *
 * @remarks
 * Truncates the input to 10,000 characters before matching to prevent
 * ReDoS on adversarial input. Strips `#` prefixes from matched numbers.
 *
 * @param pattern - The regex pattern to match (must have a capture group for issue numbers)
 * @param message - The commit message body to search
 * @returns Array of issue number strings (without `#` prefix)
 *
 * @internal
 */
function extractIssueNumbers(pattern: RegExp, message: string): string[] {
	// Limit input length to prevent ReDoS on adversarial input
	const safeMessage = message.slice(0, 10_000);
	const match = pattern.exec(safeMessage);
	if (!match?.[1]) return [];
	return match[1].split(ISSUE_NUMBER_SPLIT_PATTERN).map((num) => num.replace("#", "").trim());
}

/**
 * Parse a commit message for GitHub issue references.
 *
 * Recognizes `Closes`, `Fixes`, and `Refs` keywords with various formats:
 * - `Closes #123`
 * - `Fixes: #456, #789`
 * - `Refs #101`
 *
 * @remarks
 * Each keyword category is matched independently, so a single commit
 * message can contain references in all three categories. Keywords are
 * case-insensitive and accept both singular and plural forms.
 *
 * @param commitMessage - The commit message body to parse
 * @returns Categorized issue references with numbers as strings (no `#` prefix)
 *
 * @example
 * ```typescript
 * import { parseIssueReferences } from "../utils/issue-refs.js";
 *
 * const refs = parseIssueReferences("feat: add API\n\nCloses #42\nFixes: #17, #23");
 * // refs.closes === ["42"]
 * // refs.fixes === ["17", "23"]
 * // refs.refs === []
 * ```
 *
 * @internal
 */
export function parseIssueReferences(commitMessage: string): IssueReferences {
	return {
		closes: extractIssueNumbers(CLOSES_ISSUE_PATTERN, commitMessage),
		fixes: extractIssueNumbers(FIXES_ISSUE_PATTERN, commitMessage),
		refs: extractIssueNumbers(REFS_ISSUE_PATTERN, commitMessage),
	};
}
