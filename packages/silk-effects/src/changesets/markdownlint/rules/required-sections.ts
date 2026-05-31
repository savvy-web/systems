import type { Rule } from "markdownlint";

import { allHeadings, isValidHeading } from "../../categories/index.js";
import { RULE_DOCS, getHeadingLevel, getHeadingText } from "./utils.js";

/**
 * markdownlint rule: `changeset-required-sections` (CSH002).
 *
 * Validates that every h2 (`atxHeading` with depth 2) in a changeset markdown
 * file matches a known category heading from the category system. When an
 * unrecognized heading is found, the error detail lists all valid headings.
 *
 * @remarks
 * Heading comparison is case-insensitive. The set of valid headings is provided
 * by `allHeadings()` and `isValidHeading()` from the category system
 * (`src/categories/index.ts`). This rule inspects `atxHeading` micromark
 * tokens and extracts their text via the {@link getHeadingText} utility.
 *
 * This rule mirrors the remark-lint rule `remarkLintRequiredSections` but uses
 * markdownlint's micromark token API so it can run inside markdownlint-cli2 and
 * the VS Code markdownlint extension.
 *
 * @example
 * ```json
 * {
 *   "changeset-required-sections": true
 * }
 * ```
 *
 * @see {@link https://github.com/savvy-web/changesets/blob/main/docs/rules/CSH002.md | CSH002 rule documentation}
 * @see `src/remark/rules/required-sections.ts` for the corresponding remark-lint rule
 *
 * @public
 */
export const RequiredSectionsRule: Rule = {
	names: ["changeset-required-sections", "CSH002"],
	description: "Section headings must match known changeset categories",
	tags: ["changeset"],
	parser: "micromark",
	function: function CSH002(params, onError) {
		for (const token of params.parsers.micromark.tokens) {
			if (token.type !== "atxHeading") {
				continue;
			}

			if (getHeadingLevel(token) !== 2) {
				continue;
			}

			const text = getHeadingText(token);

			if (!isValidHeading(text)) {
				onError({
					lineNumber: token.startLine,
					detail: `Unknown section "${text}". Valid h2 headings are: ${allHeadings().join(", ")}. Heading comparison is case-insensitive. See: ${RULE_DOCS.CSH002}`,
				});
			}
		}
	},
};
