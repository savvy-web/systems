/**
 * Changelog entry formatting helpers.
 *
 * Provides the low-level string-formatting functions used by
 * {@link getReleaseLine} and {@link getDependencyReleaseLine} to produce
 * markdown changelog entries. These helpers handle commit-link generation,
 * issue reference formatting, and pull-request/user attribution.
 *
 * @remarks
 * This module is the final stage of the release-line formatting pipeline.
 * After the changelog formatters have resolved GitHub metadata and parsed
 * the changeset summary, they delegate to {@link formatChangelogEntry} and
 * {@link formatPRAndUserAttribution} to produce the actual markdown output.
 *
 * The functions in this module are pure (no side effects, no Effect context)
 * and operate on already-validated data.
 *
 * @internal
 */

import type { IssueReferences } from "../utils/issue-refs.js";
import { extractUrlFromMarkdown } from "../utils/markdown-link.js";

/**
 * A single changelog entry ready for formatting.
 *
 * Represents the fully-resolved data needed to render one changelog line:
 * the commit hash (optional), the conventional commit type, the human-readable
 * summary, and any issue references extracted from the changeset body.
 *
 * @internal
 */
export interface ChangelogEntry {
	/** Full SHA-1 commit hash. When present, a short-hash link is rendered. */
	commit?: string;
	/** Conventional commit type or resolved category heading (e.g., `"Features"`, `"Bug Fixes"`). */
	type: string;
	/** Human-readable summary description of the change. */
	summary: string;
	/** GitHub issue references parsed from the changeset body (closes, fixes, refs). */
	issues: IssueReferences;
}

/**
 * Issue reference categories and their display labels.
 *
 * Used by {@link formatChangelogEntry} to render issue links grouped
 * by their relationship to the change (Closes, Fixes, Refs).
 *
 * @internal
 */
const ISSUE_CATEGORIES = [
	{ key: "closes", label: "Closes" },
	{ key: "fixes", label: "Fixes" },
	{ key: "refs", label: "Refs" },
] as const;

/**
 * Format a changelog entry into a markdown string with GitHub links.
 *
 * Produces a commit-link prefix (shortened to 7 characters) followed by the
 * summary text and any issue references, each rendered as GitHub links.
 *
 * @remarks
 * The output does **not** include a leading `- ` list marker — the caller
 * is responsible for wrapping the result in a markdown list item. Issue
 * references are appended on a new paragraph (double newline) when present,
 * grouped by category: "Closes", "Fixes", "Refs".
 *
 * Output format examples:
 *
 * With commit: `[short-hash](commit-url) Summary text`
 *
 * With issues: `Summary text` followed by `Closes: [#1](issue-url)`
 *
 * With both: `[short-hash](commit-url) Summary text` followed by `Fixes: [#2](issue-url)`
 *
 * @param entry - The changelog entry containing commit, summary, and issue data
 * @param options - Must include `repo` in `owner/repo` format for link generation
 * @returns Formatted markdown string (without leading `- `)
 *
 * @internal
 */
export function formatChangelogEntry(entry: ChangelogEntry, options: { repo: string }): string {
	const parts: string[] = [];

	if (entry.commit) {
		const shortHash = entry.commit.substring(0, 7);
		parts.push(`[\`${shortHash}\`](https://github.com/${options.repo}/commit/${entry.commit})`);
	}

	parts.push(entry.summary.trim());

	const issueLinks: string[] = [];
	for (const { key, label } of ISSUE_CATEGORIES) {
		const numbers = entry.issues[key];
		if (numbers.length > 0) {
			const links = numbers.map((num) => `[#${num}](https://github.com/${options.repo}/issues/${num})`);
			issueLinks.push(`${label}: ${links.join(", ")}`);
		}
	}

	if (issueLinks.length > 0) {
		parts.push(`\n\n${issueLinks.join(". ")}`);
	}

	return parts.join(" ");
}

/**
 * Format pull-request reference and user attribution for a changelog entry.
 *
 * Appends a PR link and/or a "Thanks \@user!" attribution suffix to a
 * changelog line. The output includes a leading space when non-empty, so it
 * can be directly concatenated after the main entry text.
 *
 * @remarks
 * The `links` parameter may contain either plain URLs or markdown-formatted
 * links (e.g., `[#42](https://...)`). This function handles both formats
 * via {@link extractUrlFromMarkdown}, which strips the markdown link syntax
 * and extracts the raw URL.
 *
 * Output format examples:
 *
 * PR only: `[#42](pr-url)`
 *
 * PR without link: `(#42)`
 *
 * User only: `Thanks user!`
 *
 * Both: `[#42](pr-url) Thanks [user](profile-url)!`
 *
 * Neither: empty string
 *
 * @param pr - Pull request number (omit if no PR is associated)
 * @param user - GitHub username of the contributor (omit if unknown)
 * @param links - Optional pre-formatted links for the PR and user from the GitHub API
 * @returns Formatted attribution string (with leading space) or empty string
 *
 * @internal
 */
export function formatPRAndUserAttribution(
	pr?: number,
	user?: string,
	links?: { pull?: string; user?: string },
): string {
	let prReference = "";

	if (pr) {
		if (links?.pull) {
			const pullUrl = extractUrlFromMarkdown(links.pull);
			prReference = ` [#${String(pr)}](${pullUrl})`;
		} else {
			prReference = ` (#${String(pr)})`;
		}
	}

	if (user) {
		if (links?.user) {
			const userUrl = extractUrlFromMarkdown(links.user);
			return `${prReference} Thanks [@${user}](${userUrl})!`;
		}
		return `${prReference} Thanks @${user}!`;
	}

	return prReference;
}
