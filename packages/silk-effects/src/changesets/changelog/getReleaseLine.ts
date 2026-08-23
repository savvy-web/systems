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
 *    as an h3 heading with list items beneath it. This mode
 *    produces multi-line output suitable for rich changelogs.
 *
 * 2. **Flat-text changesets** — When the summary is plain text without section
 *    headings, the formatter falls back to backward-compatible single-line
 *    output. The conventional commit type is resolved via `resolveCommitType`
 *    to determine the changelog category.
 *
 * In both modes, the formatter:
 * - Fetches GitHub metadata (PR number, author) via {@link GitHubService}
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
import type { Heading, List, Paragraph, PhrasingContent, Root, RootContent } from "mdast";

import { resolveCommitType } from "../categories/index.js";
import { GitHubInfoSchema } from "../schemas/github.js";
import type { ChangesetOptions } from "../schemas/options.js";
import { GitHubService } from "../services/github.js";
import { parseCommitMessage } from "../utils/commit-parser.js";
import { parseIssueReferences } from "../utils/issue-refs.js";
import { logWarning } from "../utils/logger.js";
import { parseMarkdown, stringifyMarkdown } from "../utils/remark-pipeline.js";
import { parseChangesetSections } from "../utils/section-parser.js";
import type { GitHubCommitInfo } from "../vendor/github-info.js";
import type { NewChangesetWithCommit, VersionType } from "../vendor/types.js";
import type { ChangelogEntry } from "./formatting.js";
import { formatChangelogEntry, formatPRAndUserAttribution } from "./formatting.js";

/**
 * Stringify a single MDAST block node back to markdown, trimmed.
 *
 * @internal
 */
function stringifyNode(node: RootContent): string {
	const root: Root = { type: "root", children: [node] };
	return stringifyMarkdown(root).trimEnd();
}

/**
 * Render one top-level section content node to markdown.
 *
 * @remarks
 * The emit decision is made on the node type, never on string prefixes:
 *
 * - **paragraph** — rendered as a `- ` bullet, with continuation lines
 *   indented two spaces so multi-line prose stays inside the list item
 *   (the historical behavior for simple prose content).
 * - **heading** — promoted one level so a changeset `###` sub-heading emits
 *   as `####` and can never collide with the changelog's depth-3 category
 *   headings (which the version-block utilities and merge/reorder/dedup
 *   plugins treat as section boundaries). Depths are clamped to the 4–6
 *   range: promoting below 4 could fabricate a version or category heading.
 * - **everything else** (list, table, code fence, blockquote, ...) — passes
 *   through verbatim as a block: never bullet-prefixed, never
 *   continuation-indented.
 *
 * @internal
 */
function renderSectionNode(node: RootContent): string {
	if (node.type === "paragraph") {
		const lines = stringifyNode(node).split("\n");
		const [first, ...rest] = lines;
		return [`- ${first}`, ...rest.map((line) => (line.length > 0 ? `  ${line}` : line))].join("\n");
	}
	if (node.type === "heading") {
		const heading = node as Heading;
		const promoted: Heading = {
			...heading,
			depth: Math.min(Math.max(heading.depth + 1, 4), 6) as Heading["depth"],
		};
		return stringifyNode(promoted);
	}
	return stringifyNode(node);
}

/**
 * Parse an attribution suffix (e.g. `" [#42](url) Thanks [\@user](url)!"`)
 * into phrasing nodes ready to append to a paragraph, prefixed with a
 * separating space.
 *
 * @internal
 */
function attributionPhrasing(attribution: string): PhrasingContent[] | undefined {
	const trimmed = attribution.trim();
	if (trimmed === "") return undefined;
	const first = parseMarkdown(trimmed).children[0];
	if (first?.type !== "paragraph") return undefined;
	return [{ type: "text", value: " " }, ...(first as Paragraph).children];
}

/**
 * Find the paragraph the attribution should be appended to: the LAST
 * top-level paragraph, or the last paragraph of the last item of the LAST
 * top-level list, across all section content nodes. Tables, headings, code
 * fences and blockquotes are never targets — attribution must not land
 * inside them.
 *
 * @internal
 */
function findAttributionTarget(sections: readonly { contentNodes: RootContent[] }[]): Paragraph | undefined {
	let target: Paragraph | undefined;
	for (const section of sections) {
		for (const node of section.contentNodes) {
			if (node.type === "paragraph") {
				target = node as Paragraph;
			} else if (node.type === "list") {
				const items = (node as List).children;
				const lastItem = items[items.length - 1];
				const lastParagraph = lastItem?.children
					.filter((child): child is Paragraph => child.type === "paragraph")
					.at(-1);
				if (lastParagraph) target = lastParagraph;
			}
		}
	}
	return target;
}

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
 *    h3 heading with list items.
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
					Schema.decodeUnknownEffect(GitHubInfoSchema)(raw).pipe(
						Effect.map(() => raw),
						Effect.catch(() => Effect.succeed(raw)),
					),
				),
				Effect.catch((error) => {
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

		// 5. Build attribution suffix. `thanks: false` strips the user credit
		//    everywhere; the PR reference is provenance, not thanks, and stays.
		const includeThanks = options.thanks !== false;
		const attribution = commitInfo
			? formatPRAndUserAttribution(
					commitInfo.pull ?? undefined,
					includeThanks ? (commitInfo.user ?? undefined) : undefined,
					commitInfo.links as { pull?: string; user?: string },
				)
			: "";

		// 6. Section-aware formatting (h2 headings present). Rendering is
		//    AST-native: each content node is emitted by type (see
		//    renderSectionNode), so headings, tables, code fences and
		//    blockquotes pass through as blocks instead of being wrapped
		//    into a bullet.
		if (parsed.sections.length > 0) {
			// Attribution attaches to the last paragraph/bullet across the whole
			// entry — never to a table row or heading. Mutate before rendering.
			const phrasing = attributionPhrasing(attribution);
			let standaloneAttribution: string | undefined;
			if (phrasing) {
				const target = findAttributionTarget(parsed.sections);
				if (target) {
					target.children.push(...phrasing);
				} else {
					standaloneAttribution = attribution.trim();
				}
			}

			const blocks: string[] = [];
			if (parsed.preamble) blocks.push(parsed.preamble);

			for (const section of parsed.sections) {
				blocks.push(`### ${section.category.heading}`);
				for (const node of section.contentNodes) {
					blocks.push(renderSectionNode(node));
				}
			}

			if (standaloneAttribution) blocks.push(standaloneAttribution);
			return blocks.join("\n\n");
		}

		// 7. Flat-text formatting (backward-compatible)
		const commitType = commitMsg.type ?? versionType;
		const category = resolveCommitType(commitType, commitMsg.scope, commitMsg.breaking);

		const entryInput: ChangelogEntry = {
			type: category.heading,
			summary: changeset.summary,
			issues: issueRefs,
		};

		const entry = formatChangelogEntry(entryInput, { repo: options.repo });

		return `- ${entry}${attribution}`;
	});
}
