// Constants for changeset lint rule documentation URLs.
//
// Each CSH lint rule has a corresponding documentation page under this
// package's docs tree (packages/silk-effects/docs/rules/). These URLs are
// referenced in lint diagnostic messages to help users understand and
// resolve validation errors.
//
// Rule codes follow the `CSH` prefix convention:
// - `CSH001` -- Heading hierarchy (no h1, no depth skips)
// - `CSH002` -- Required sections (h2 headings match the 13 categories)
// - `CSH003` -- Content structure (no empty sections/items, fence languages)
// - `CSH004` -- Uncategorized content (nothing before the first h2)
// - `CSH005` -- Dependency table format (5-column table in ## Dependencies)

/**
 * Base URL for rule documentation on GitHub.
 *
 * The former home (savvy-web/changesets) is archived; the docs live in the
 * systems monorepo alongside the rule sources (savvy-web/systems#456).
 */
const DOCS_BASE = "https://github.com/savvy-web/systems/blob/main/packages/silk-effects/docs/rules";

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
