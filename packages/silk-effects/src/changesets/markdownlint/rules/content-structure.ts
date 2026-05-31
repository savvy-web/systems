import type { MicromarkToken, Rule } from "markdownlint";

import { RULE_DOCS, getHeadingLevel } from "./utils.js";

/**
 * Check whether any non-blank tokens exist between two indices in the token stream.
 *
 * @param tokens - The full micromark token array
 * @param currentIdx - Start index (exclusive)
 * @param nextIdx - End index (exclusive)
 * @returns `true` when at least one non-lineEnding token exists in the range
 *
 * @internal
 */
function hasContentBetween(tokens: MicromarkToken[], currentIdx: number, nextIdx: number): boolean {
	for (let i = currentIdx + 1; i < nextIdx; i++) {
		const token = tokens[i];
		if (token.type !== "lineEnding" && token.type !== "lineEndingBlank") {
			return true;
		}
	}
	return false;
}

/**
 * markdownlint rule: `changeset-content-structure` (CSH003).
 *
 * Validates content quality inside changeset markdown files by inspecting
 * micromark tokens for three categories of structural problems:
 *
 * 1. **Empty sections** -- an `atxHeading` (h2) followed immediately by another
 *    h2 or the end of the token stream with no intervening content tokens.
 * 2. **Code blocks without a language identifier** -- a `codeFenced` token whose
 *    opening fence child lacks a `codeFencedFenceInfo` token.
 * 3. **Empty list items** -- a `listItemPrefix` token with no subsequent
 *    `content` token before the next prefix or end of list.
 *
 * @remarks
 * This rule mirrors the remark-lint rule `remarkLintContentStructure` but uses
 * markdownlint's micromark token API so it can run inside markdownlint-cli2 and
 * the VS Code markdownlint extension.
 *
 * @example
 * ```json
 * {
 *   "changeset-content-structure": true
 * }
 * ```
 *
 * @see {@link https://github.com/savvy-web/changesets/blob/main/docs/rules/CSH003.md | CSH003 rule documentation}
 * @see `src/remark/rules/content-structure.ts` for the corresponding remark-lint rule
 *
 * @public
 */
export const ContentStructureRule: Rule = {
	names: ["changeset-content-structure", "CSH003"],
	description: "Sections must have content, code blocks need languages, list items need text",
	tags: ["changeset"],
	parser: "micromark",
	function: function CSH003(params, onError) {
		const tokens = params.parsers.micromark.tokens;

		// Collect h2 heading indices for empty section detection
		const h2Indices: number[] = [];
		for (let i = 0; i < tokens.length; i++) {
			if (tokens[i].type === "atxHeading" && getHeadingLevel(tokens[i]) === 2) {
				h2Indices.push(i);
			}
		}

		// Check for empty sections (h2 with no content before next h2 or EOF)
		for (let i = 0; i < h2Indices.length; i++) {
			const currentIdx = h2Indices[i];
			const nextIdx = i + 1 < h2Indices.length ? h2Indices[i + 1] : tokens.length;

			if (!hasContentBetween(tokens, currentIdx, nextIdx)) {
				onError({
					lineNumber: tokens[currentIdx].startLine,
					detail: `Empty section: heading has no content before the next section or end of file. Add a list of changes (e.g., "- Added feature X") under this heading, or remove the empty heading. See: ${RULE_DOCS.CSH003}`,
				});
			}
		}

		// Check code blocks for language identifier
		for (const token of tokens) {
			if (token.type !== "codeFenced") {
				continue;
			}

			// codeFencedFenceInfo is a child of codeFencedFence, not codeFenced
			const openingFence = token.children.find((c) => c.type === "codeFencedFence");
			const hasInfo = openingFence?.children.some((c) => c.type === "codeFencedFenceInfo") ?? false;
			if (!hasInfo) {
				onError({
					lineNumber: token.startLine,
					detail: `Code block is missing a language identifier. Add a language after the opening fence (e.g., \`\`\`ts, \`\`\`json, \`\`\`bash). See: ${RULE_DOCS.CSH003}`,
				});
			}
		}

		// Check list items for content
		// In micromark, list children are: listItemPrefix, content, lineEnding, listItemPrefix, content, ...
		// An empty item has a listItemPrefix with no following content before the next listItemPrefix or end
		for (const token of tokens) {
			if (token.type !== "listOrdered" && token.type !== "listUnordered") {
				continue;
			}

			const children = token.children;
			for (let i = 0; i < children.length; i++) {
				if (children[i].type !== "listItemPrefix") {
					continue;
				}

				// Check if there is meaningful content before the next listItemPrefix or end of list
				let hasContent = false;
				for (let j = i + 1; j < children.length; j++) {
					if (children[j].type === "listItemPrefix") {
						break;
					}
					if (children[j].type === "content") {
						hasContent = true;
						break;
					}
				}

				if (!hasContent) {
					onError({
						lineNumber: children[i].startLine,
						detail: `Empty list item. Each list item must contain descriptive text (e.g., "- Fixed login timeout issue"). See: ${RULE_DOCS.CSH003}`,
					});
				}
			}
		}
	},
};
