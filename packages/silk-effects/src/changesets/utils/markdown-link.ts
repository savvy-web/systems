/**
 * Markdown link extraction utilities.
 *
 * @remarks
 * Handles the inconsistency where `\@changesets/get-github-info` sometimes
 * returns markdown-formatted links (e.g., `[#17](https://...)`) instead
 * of plain URLs. Provides a regex pattern and extraction function to
 * normalize these values.
 *
 * @see {@link Changelog} for the public API that uses link extraction
 *   during changelog generation
 *
 * @internal
 */

/**
 * Pattern matching markdown link format: `[text](url)`.
 *
 * Capture groups:
 * - `[1]` — link text (e.g., `#17`)
 * - `[2]` — URL (e.g., `https://github.com/owner/repo/pull/17`)
 *
 * @internal
 */
export const MARKDOWN_LINK_PATTERN: RegExp = /\[([^\]]+)\]\(([^)]+)\)/;

/**
 * Extract a plain URL from a markdown-formatted link.
 *
 * @remarks
 * The `\@changesets/get-github-info` package sometimes returns markdown links
 * like `[#17](https://github.com/owner/repo/pull/17)` instead of plain URLs.
 * This helper extracts the URL portion, or returns the input unchanged if
 * it is already a plain URL.
 *
 * @param linkOrUrl - A markdown link or plain URL string
 * @returns The extracted plain URL
 *
 * @example
 * ```typescript
 * import { extractUrlFromMarkdown } from "../utils/markdown-link.js";
 *
 * extractUrlFromMarkdown("[#17](https://github.com/o/r/pull/17)");
 * // "https://github.com/o/r/pull/17"
 *
 * extractUrlFromMarkdown("https://github.com/o/r/pull/17");
 * // "https://github.com/o/r/pull/17" (returned unchanged)
 * ```
 *
 * @internal
 */
export function extractUrlFromMarkdown(linkOrUrl: string): string {
	const match = MARKDOWN_LINK_PATTERN.exec(linkOrUrl);
	return match ? match[2] : linkOrUrl;
}
