// GitHub issue reference parsing from commit messages.
//
// Extracts categorized issue references (`Closes`, `Fixes`, `Refs`) from
// commit message bodies using `@effected/github-references`' list grammar:
// all nine closing keyword tenses plus the non-closing `ref`/`refs`/
// `references`, mandatory `#`, and `,` / `and` / Oxford `, and` list
// separators. Two dialects compose per line — the whole-line trailer form
// (optional colon) and the inline-in-prose harvest (no colon, references may
// sit mid-sentence and several lists may share one line).
//
// See `Changelog` for the public API that consumes issue references.

import type { KeywordFamily, ReferenceList } from "@effected/github-references";
import { collectReferenceLists, keywordFamily } from "@effected/github-references";

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
 * The output category each keyword family lands in.
 *
 * @remarks
 * The `resolve` family reads as `closes` since closing is what those keywords
 * do; the record is total over `KeywordFamily`, so a family the kit adds
 * without a category here is a type error, never a silent drop.
 *
 * @internal
 */
const CATEGORY_BY_FAMILY: Record<KeywordFamily, keyof IssueReferences> = {
	close: "closes",
	fix: "fixes",
	ref: "refs",
	resolve: "closes",
};

/** @internal */
function categoryOf(list: ReferenceList): keyof IssueReferences {
	return CATEGORY_BY_FAMILY[keywordFamily(list.keyword)];
}

/**
 * Parse a commit message for GitHub issue references.
 *
 * Recognizes GitHub's closing keywords plus `Ref`/`Refs`/`References` in
 * both list dialects:
 * - whole-line trailers — `Closes #123`, `Fixes: #456, #789`, `Refs #101`;
 * - inline in prose — `This closes #12 in passing`, or several lists on one
 *   line: `Closes #123, Fixes #456`.
 *
 * @remarks
 * References accumulate in message order: two `Closes` lists contribute to
 * the same category. Keywords are case-insensitive and the `#` is mandatory.
 * The colon spelling is line-dialect-only; `collectReferenceLists` owns the
 * per-line composition (whole-line trailer parse first, inline harvest
 * otherwise), guaranteeing a trailer line is never double-counted. Malformed
 * candidates are simply skipped.
 *
 * @param commitMessage - The commit message body to parse
 * @returns Categorized issue references with numbers as strings (no `#` prefix)
 *
 * @example
 * ```typescript
 * import { parseIssueReferences } from "../utils/issue-refs.js";
 *
 * const refs = parseIssueReferences("feat: add API\n\nCloses #42, Fixes #17");
 * // refs.closes === ["42"]
 * // refs.fixes === ["17"]
 * // refs.refs === []
 * ```
 *
 * @internal
 */
export function parseIssueReferences(commitMessage: string): IssueReferences {
	const references: IssueReferences = { closes: [], fixes: [], refs: [] };
	for (const list of collectReferenceLists(commitMessage)) {
		references[categoryOf(list)].push(...list.issueNumbers.map(String));
	}
	return references;
}
