/**
 * Core formatter: getReleaseLine.
 *
 * Formats a single changeset into a changelog entry. This is the primary
 * formatting function in the changelog pipeline, responsible for transforming
 * a `NewChangesetWithCommit` into structured markdown output.
 *
 * @remarks
 * The formatter supports two distinct input modes:
 *
 * 1. **Section-aware changesets** — When the changeset summary contains h2
 *    headings (e.g., `## Features`, `## Bug Fixes`), each section is rendered
 *    as an h3 heading with commit-linked list items beneath it. This mode
 *    produces multi-line output suitable for rich changelogs.
 *
 * 2. **Flat-text changesets** — When the summary is plain text without section
 *    headings, the formatter falls back to backward-compatible single-line
 *    output. The conventional commit type is resolved via `resolveCommitType`
 *    to determine the changelog category.
 *
 * In both modes, the formatter:
 * - Fetches GitHub metadata (PR number, author) via {@link GitHubService}
 * - Generates shortened commit hash links (`[abc1234](...)`)
 * - Extracts and renders issue references (Closes, Fixes, Refs)
 * - Appends PR and user attribution when available
 *
 * @see {@link formatChangelogEntry} for the low-level entry formatting
 * @see {@link formatPRAndUserAttribution} for attribution suffix generation
 * @see {@link getDependencyReleaseLine} for the companion dependency formatter
 *
 * @internal
 */

import { Effect, Schema } from "effect";

import { resolveCommitType } from "../categories/index.js";
import { GitHubInfoSchema } from "../schemas/github.js";
import type { ChangesetOptions } from "../schemas/options.js";
import { GitHubService } from "../services/github.js";
import { parseCommitMessage } from "../utils/commit-parser.js";
import { parseIssueReferences } from "../utils/issue-refs.js";
import { logWarning } from "../utils/logger.js";
import { parseChangesetSections } from "../utils/section-parser.js";
import type { GitHubCommitInfo } from "../vendor/github-info.js";
import type { NewChangesetWithCommit, VersionType } from "../vendor/types.js";
import type { ChangelogEntry } from "./formatting.js";
import { formatChangelogEntry, formatPRAndUserAttribution } from "./formatting.js";

/**
 * Format a single changeset into a markdown release line.
 *
 * This is the core Effect program that implements the `getReleaseLine` contract
 * from the Changesets API. It requires {@link GitHubService} in its environment
 * for resolving commit metadata.
 *
 * @remarks
 * The formatting pipeline proceeds in seven steps:
 *
 * 1. **Fetch GitHub info** — If the changeset has a commit hash, query
 *    the {@link GitHubService} for PR number, author, and links. Failures
 *    are caught and logged as warnings (attribution is simply omitted).
 * 2. **Parse sections** — Attempt to split the summary into h2-delimited
 *    sections using `parseChangesetSections`.
 * 3. **Parse conventional commit** — Extract the commit type, scope, and
 *    breaking flag from the first line of the summary.
 * 4. **Extract issue references** — Parse the body for `Closes #N`,
 *    `Fixes #N`, and `Refs #N` patterns.
 * 5. **Build attribution** — Format PR link and user credit from GitHub info.
 * 6. **Section-aware output** — If sections were found, render each as an
 *    h3 heading with commit-linked list items.
 * 7. **Flat-text fallback** — Otherwise, produce a single `- entry` line
 *    with the resolved category heading.
 *
 * @param changeset - The changeset to format, including commit hash and summary text
 * @param versionType - The semantic version bump type (`major`, `minor`, or `patch`),
 *   used as fallback when no conventional commit type is detected
 * @param options - Validated configuration options (must include `repo` in `owner/repo` format)
 * @returns An `Effect` that resolves to a formatted markdown string
 */
export function getReleaseLine(
	changeset: NewChangesetWithCommit,
	versionType: VersionType,
	options: ChangesetOptions,
): Effect.Effect<string, never, GitHubService> {
	return Effect.gen(function* () {
		// 1. Fetch GitHub info if we have a commit
		let commitInfo: GitHubCommitInfo | null = null;
		if (changeset.commit) {
			const github = yield* GitHubService;
			commitInfo = yield* github.getInfo({ commit: changeset.commit, repo: options.repo }).pipe(
				// Validate response shape
				Effect.flatMap((raw) =>
					Schema.decodeUnknown(GitHubInfoSchema)(raw).pipe(
						Effect.map(() => raw),
						Effect.catchAll(() => Effect.succeed(raw)),
					),
				),
				Effect.catchAll((error) => {
					logWarning("Could not fetch GitHub info for commit:", changeset.commit ?? "", String(error));
					return Effect.succeed(null);
				}),
			);
		}

		// 2. Parse summary for sections
		const parsed = parseChangesetSections(changeset.summary);

		// 3. Parse first line for conventional commit
		const firstLine = changeset.summary.split("\n")[0];
		const commitMsg = parseCommitMessage(firstLine);

		// 4. Extract issue references from body
		const bodyText = changeset.summary.split("\n").slice(1).join("\n");
		const issueRefs = parseIssueReferences(bodyText);

		// 5. Build attribution suffix
		const attribution = commitInfo
			? formatPRAndUserAttribution(
					commitInfo.pull ?? undefined,
					commitInfo.user ?? undefined,
					commitInfo.links as { pull?: string; user?: string },
				)
			: "";

		// 6. Section-aware formatting (h2 headings present)
		if (parsed.sections.length > 0) {
			const lines: string[] = [];

			if (parsed.preamble) {
				lines.push(parsed.preamble);
				lines.push("");
			}

			for (const section of parsed.sections) {
				lines.push(`### ${section.category.heading}`);
				lines.push("");

				// Format content as list items with commit link
				const commitPrefix = changeset.commit
					? `[\`${changeset.commit.substring(0, 7)}\`](https://github.com/${options.repo}/commit/${changeset.commit}) `
					: "";

				if (section.content) {
					// Content may already contain list items; prefix first line
					const contentLines = section.content.split("\n");
					const firstContentLine = contentLines[0];
					if (firstContentLine.startsWith("- ") || firstContentLine.startsWith("* ")) {
						// Content already has list markers
						lines.push(`${firstContentLine.substring(0, 2)}${commitPrefix}${firstContentLine.substring(2)}`);
						lines.push(...contentLines.slice(1));
					} else {
						lines.push(`- ${commitPrefix}${section.content}`);
					}
				}
				lines.push("");
			}

			const result = lines.join("\n").trimEnd();
			return `${result}${attribution}`;
		}

		// 7. Flat-text formatting (backward-compatible)
		const commitType = commitMsg.type ?? versionType;
		const category = resolveCommitType(commitType, commitMsg.scope, commitMsg.breaking);

		const entryInput: ChangelogEntry = {
			type: category.heading,
			summary: changeset.summary,
			issues: issueRefs,
			...(changeset.commit ? { commit: changeset.commit } : {}),
		};

		const entry = formatChangelogEntry(entryInput, { repo: options.repo });

		return `- ${entry}${attribution}`;
	});
}
