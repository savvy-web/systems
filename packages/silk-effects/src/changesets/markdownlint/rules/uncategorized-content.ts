import type { Rule } from "markdownlint";

import { RULE_DOCS, getHeadingLevel } from "./utils.js";

/**
 * markdownlint rule: `changeset-uncategorized-content` (CSH004).
 *
 * Detects content that appears before the first h2 heading in a changeset
 * markdown file. All substantive content must be placed under a categorized
 * section (`## heading`).
 *
 * @remarks
 * The rule iterates over the top-level micromark token stream and stops at the
 * first `atxHeading` with depth 2. Any token encountered before that heading
 * that is not a `lineEnding`, `lineEndingBlank`, or `htmlFlow` (HTML comments)
 * triggers an error. This ensures that changeset content is always grouped
 * under a recognized category heading.
 *
 * This rule mirrors the remark-lint rule `remarkLintUncategorizedContent` but
 * uses markdownlint's micromark token API so it can run inside
 * markdownlint-cli2 and the VS Code markdownlint extension.
 *
 * @example
 * ```json
 * {
 *   "changeset-uncategorized-content": true
 * }
 * ```
 *
 * @see {@link https://github.com/savvy-web/changesets/blob/main/docs/rules/CSH004.md | CSH004 rule documentation}
 * @see `src/remark/rules/uncategorized-content.ts` for the corresponding remark-lint rule
 *
 * @public
 */
export const UncategorizedContentRule: Rule = {
	names: ["changeset-uncategorized-content", "CSH004"],
	description: "All content must be placed under a category heading (## heading)",
	tags: ["changeset"],
	parser: "micromark",
	function: function CSH004(params, onError) {
		const tokens = params.parsers.micromark.tokens;

		for (const token of tokens) {
			// Stop at the first h2 — everything after is categorized
			if (token.type === "atxHeading" && getHeadingLevel(token) === 2) {
				break;
			}

			// Skip blank lines, line endings, and HTML comments
			if (token.type === "lineEnding" || token.type === "lineEndingBlank" || token.type === "htmlFlow") {
				continue;
			}

			// Any other top-level token before the first h2 is uncategorized content
			if (token.type !== "atxHeading") {
				onError({
					lineNumber: token.startLine,
					detail: `Content must be placed under a category heading (## heading). Move this content under an appropriate section like "## Features" or "## Bug Fixes". If it doesn't fit an existing category, use "## Other". See: ${RULE_DOCS.CSH004}`,
				});
			}
		}
	},
};
