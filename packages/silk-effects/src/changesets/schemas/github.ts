/**
 * GitHub-related Effect schemas for usernames, issue numbers, and API responses.
 *
 * @remarks
 * These schemas validate data returned by the `\@changesets/get-github-info`
 * vendor module and enforce GitHub's naming conventions for usernames and
 * issue references.
 *
 * @see {@link https://effect.website/docs/schema/introduction | Effect Schema documentation}
 *
 * @packageDocumentation
 */

import { Schema } from "effect";

import { MARKDOWN_LINK_PATTERN } from "../utils/markdown-link.js";
import { PositiveInteger } from "./primitives.js";

/**
 * Test whether a string is a valid URL.
 *
 * @internal
 */
function isValidUrl(value: string): boolean {
	try {
		new URL(value);
		return true;
	} catch {
		return false;
	}
}

/**
 * Schema for a GitHub username.
 *
 * @remarks
 * Validates against GitHub's username rules: alphanumeric characters and
 * hyphens only, cannot start or end with a hyphen. Does not enforce the
 * 39-character maximum length since GitHub may change that limit.
 *
 * @example
 * ```typescript
 * import { Schema } from "effect";
 * import { UsernameSchema } from "@savvy-web/changesets";
 *
 * // Succeeds
 * Schema.decodeUnknownSync(UsernameSchema)("octocat");
 * Schema.decodeUnknownSync(UsernameSchema)("my-user-123");
 *
 * // Throws ParseError — starts with hyphen
 * Schema.decodeUnknownSync(UsernameSchema)("-invalid");
 * ```
 *
 * @see {@link GitHubInfoSchema} which uses this for the `user` field
 *
 * @public
 */
export const UsernameSchema = Schema.String.pipe(
	Schema.pattern(/^[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?$/, {
		message: () =>
			'Invalid GitHub username format. Usernames must contain only alphanumeric characters and hyphens, and cannot start or end with a hyphen. Example: "octocat" or "my-user-123"',
	}),
);

/**
 * Schema for a GitHub issue or PR number (positive integer).
 *
 * @remarks
 * Built on {@link PositiveInteger}, this schema adds GitHub-specific
 * annotations for documentation tooling. Issue and PR numbers in GitHub
 * are always positive integers starting from 1.
 *
 * @example
 * ```typescript
 * import { Schema } from "effect";
 * import { IssueNumberSchema } from "@savvy-web/changesets";
 *
 * // Succeeds
 * const prNum = Schema.decodeUnknownSync(IssueNumberSchema)(42);
 *
 * // Throws ParseError — zero is not a valid issue number
 * Schema.decodeUnknownSync(IssueNumberSchema)(0);
 * ```
 *
 * @see {@link GitHubInfoSchema} which uses this for the `pull` field
 *
 * @public
 */
export const IssueNumberSchema = PositiveInteger.annotations({
	title: "IssueNumber",
	description: "GitHub issue or pull request number",
});

/**
 * Schema accepting either a plain URL or a markdown link `[text](url)`.
 *
 * @remarks
 * The `\@changesets/get-github-info` vendor module returns links in two
 * possible formats depending on context: a bare URL string or a markdown
 * link like `[#42](https://github.com/owner/repo/pull/42)`. This schema
 * accepts both, validating that the URL portion is parseable by the
 * `URL` constructor.
 *
 * @example
 * ```typescript
 * import { Schema } from "effect";
 * import { UrlOrMarkdownLinkSchema } from "@savvy-web/changesets";
 *
 * // Succeeds — plain URL
 * Schema.decodeUnknownSync(UrlOrMarkdownLinkSchema)(
 * 	"https://github.com/owner/repo/pull/42"
 * );
 *
 * // Succeeds — markdown link
 * Schema.decodeUnknownSync(UrlOrMarkdownLinkSchema)(
 * 	"[#42](https://github.com/owner/repo/pull/42)"
 * );
 *
 * // Throws ParseError — not a URL or markdown link
 * Schema.decodeUnknownSync(UrlOrMarkdownLinkSchema)("not-a-url");
 * ```
 *
 * @see {@link GitHubInfoSchema} which uses this for commit, pull, and user links
 *
 * @public
 */
export const UrlOrMarkdownLinkSchema = Schema.String.pipe(
	Schema.filter(
		(value) => {
			if (isValidUrl(value)) return true;

			const match = MARKDOWN_LINK_PATTERN.exec(value);
			return match?.[2] ? isValidUrl(match[2]) : false;
		},
		{
			message: () =>
				'Value must be a valid URL or a markdown link. Expected a plain URL (e.g., "https://github.com/owner/repo/pull/42") or a markdown link (e.g., "[#42](https://github.com/owner/repo/pull/42)")',
		},
	),
);

/**
 * Schema for a GitHub info response from `\@changesets/get-github-info`.
 *
 * @remarks
 * Represents the structured data returned when querying GitHub for commit
 * metadata. The `user` and `pull` fields are optional because not every
 * commit is associated with a pull request or a known GitHub user (e.g.,
 * bot commits or squash-merged commits without a linked PR).
 *
 * The `links` object contains pre-formatted markdown or URL strings for
 * the commit, pull request, and user profile -- ready for insertion into
 * CHANGELOG entries.
 *
 * @example
 * ```typescript
 * import { Schema } from "effect";
 * import { GitHubInfoSchema } from "@savvy-web/changesets";
 * import type { GitHubInfo } from "@savvy-web/changesets";
 *
 * const info: GitHubInfo = Schema.decodeUnknownSync(GitHubInfoSchema)({
 * 	user: "octocat",
 * 	pull: 42,
 * 	links: {
 * 		commit: "[`a1b2c3d`](https://github.com/owner/repo/commit/a1b2c3d)",
 * 		pull: "[#42](https://github.com/owner/repo/pull/42)",
 * 		user: "[@octocat](https://github.com/octocat)",
 * 	},
 * });
 * ```
 *
 * @see {@link GitHubInfo} for the inferred TypeScript type
 * @see {@link GitHubService} for the Effect service that produces these values
 *
 * @public
 */
export const GitHubInfoSchema = Schema.Struct({
	/** GitHub username of the commit author. */
	user: Schema.optional(UsernameSchema),
	/** Pull request number associated with the commit. */
	pull: Schema.optional(IssueNumberSchema),
	/** Markdown-formatted links. */
	links: Schema.Struct({
		/** Link to the commit. */
		commit: UrlOrMarkdownLinkSchema,
		/** Link to the associated pull request. */
		pull: Schema.optional(UrlOrMarkdownLinkSchema),
		/** Link to the author's GitHub profile. */
		user: Schema.optional(UrlOrMarkdownLinkSchema),
	}),
});

/**
 * Inferred type for {@link GitHubInfoSchema}.
 *
 * @remarks
 * Contains optional `user` (GitHub username), optional `pull` (PR number),
 * and a required `links` object with pre-formatted commit, pull, and user
 * links.
 *
 * @public
 */
export interface GitHubInfo extends Schema.Schema.Type<typeof GitHubInfoSchema> {}
