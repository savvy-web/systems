/**
 * Utility for stripping YAML frontmatter from changeset files.
 *
 * @remarks
 * Changeset `.md` files produced by `\@changesets/cli` contain YAML
 * frontmatter (delimited by `---`) specifying which packages are
 * affected and their version bump types. This frontmatter must be
 * removed before remark-lint processing, as remark-parse does not
 * handle YAML frontmatter natively without `remark-frontmatter`.
 *
 * The regex used is non-greedy (`[\s\S]*?`) to match only the first
 * frontmatter block and avoid stripping content after a second `---`
 * delimiter that might appear in the document body.
 *
 * @see {@link ChangesetLinter} for the public API that uses frontmatter
 *   stripping during changeset validation
 *
 * @internal
 */

/**
 * Strip leading YAML frontmatter from a markdown string.
 *
 * Removes the `---\n...\n---\n` block at the start of the content.
 * If no frontmatter is present, the content is returned as-is.
 *
 * @param content - Raw markdown string potentially containing frontmatter
 * @returns The markdown content with frontmatter removed
 *
 * @example
 * ```typescript
 * import { stripFrontmatter } from "../utils/strip-frontmatter.js";
 *
 * const raw = "---\n\"pkg\": minor\n---\n\n## Features\n\n- New API";
 * const body = stripFrontmatter(raw);
 * // "\n## Features\n\n- New API"
 * ```
 *
 * @internal
 */
export function stripFrontmatter(content: string): string {
	return content.replace(/^---\n[\s\S]*?\n---\n?/, "");
}
