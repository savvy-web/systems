/**
 * Constants for changeset lint rule documentation URLs.
 *
 * @remarks
 * Each lint rule in the \@savvy-web/changesets remark-lint plugin has a
 * corresponding documentation page hosted on GitHub. These URLs are
 * referenced in lint diagnostic messages to help users understand and
 * resolve validation errors.
 *
 * Rule codes follow the `CSH` prefix convention:
 * - `CSH001` -- Changeset heading validation
 * - `CSH002` -- Changeset summary validation
 * - `CSH003` -- Dependency table structure validation
 * - `CSH004` -- Changeset body content validation
 * - `CSH005` -- Frontmatter validation
 *
 * @internal
 * @packageDocumentation
 */

/** Base URL for rule documentation on GitHub. */
const DOCS_BASE = "https://github.com/savvy-web/changesets/blob/main/docs/rules";

/**
 * Documentation URLs for each changeset lint rule.
 *
 * @remarks
 * Keyed by rule code (`CSH001`--`CSH005`). Each value is a full URL
 * pointing to the rule's documentation page on GitHub. Used by the
 * remark-lint plugins to attach documentation links to diagnostic
 * messages.
 *
 * @internal
 */
export const RULE_DOCS = {
	CSH001: `${DOCS_BASE}/CSH001.md`,
	CSH002: `${DOCS_BASE}/CSH002.md`,
	CSH003: `${DOCS_BASE}/CSH003.md`,
	CSH004: `${DOCS_BASE}/CSH004.md`,
	CSH005: `${DOCS_BASE}/CSH005.md`,
} as const;
