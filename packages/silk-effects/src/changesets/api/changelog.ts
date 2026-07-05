/**
 * Class-based API wrapper for changelog formatting.
 *
 * Provides a static class interface that delegates to the underlying
 * Changesets API-compatible default export.
 *
 * @internal
 */

import changelogFunctions from "../changelog/index.js";
import type { ModCompWithPackage, NewChangesetWithCommit, VersionType } from "../vendor/types.js";

/**
 * Static class wrapper for changelog formatting operations.
 *
 * Delegates to the Changesets-compatible `getReleaseLine` and
 * `getDependencyReleaseLine` functions. Internally, these use the
 * {@link ChangelogService} Effect service layer, which coordinates
 * the {@link GitHubService} (for commit/PR metadata) and
 * {@link MarkdownService} (for AST manipulation) to produce
 * structured changelog entries.
 *
 * @remarks
 * This class provides the same formatting capabilities as the
 * `\@savvy-web/changesets/changelog` subpath export, but through a
 * class-based API rather than the Changesets default-export convention.
 * The underlying formatter parses conventional commit prefixes from the
 * changeset summary to determine the section category (via
 * {@link Categories}), resolves GitHub metadata (authors, PR links,
 * commit hashes), and produces markdown output grouped by category.
 *
 * The `options` parameter must include a `repo` field in `"owner/repo"`
 * format (e.g., `"savvy-web/changesets"`) so that GitHub links can be
 * constructed. Additional options are defined by {@link ChangesetOptionsSchema}.
 *
 * @example Formatting a single changeset release line
 * ```typescript
 * import { Changelog } from "\@savvy-web/changesets";
 *
 * const changeset = {
 *   id: "brave-pandas-learn",
 *   summary: "feat: add token refresh endpoint",
 *   releases: [{ name: "\@savvy-web/auth", type: "minor" as const }],
 *   commit: "abc1234567890abcdef1234567890abcdef123456",
 * };
 *
 * const line: string = await Changelog.formatReleaseLine(changeset, "minor", {
 *   repo: "savvy-web/auth",
 * });
 * // line contains a markdown bullet under the "Features" section heading
 * ```
 *
 * @example Formatting dependency update lines
 * ```typescript
 * import { Changelog } from "\@savvy-web/changesets";
 *
 * const changesets = [
 *   {
 *     id: "cool-dogs-fly",
 *     summary: "chore(deps): update effect to 3.20.0",
 *     releases: [{ name: "\@savvy-web/core", type: "patch" as const }],
 *     commit: "def4567890abcdef1234567890abcdef456789ab",
 *   },
 * ];
 *
 * const dependenciesUpdated = [
 *   {
 *     name: "\@savvy-web/utils",
 *     type: "patch" as const,
 *     oldVersion: "1.2.0",
 *     newVersion: "1.2.1",
 *     changesets: ["cool-dogs-fly"],
 *     packageJson: { name: "\@savvy-web/utils", version: "1.2.1" },
 *   },
 * ];
 *
 * const depLines: string = await Changelog.formatDependencyReleaseLine(
 *   changesets,
 *   dependenciesUpdated,
 *   { repo: "savvy-web/core" },
 * );
 * // depLines contains a markdown table of dependency changes
 * ```
 *
 * @see {@link ChangelogService} for the underlying Effect service
 * @see {@link Categories} for how commit types map to section headings
 * @see {@link ChangesetOptionsSchema} for the full options schema
 *
 * @public
 */
export class Changelog {
	/* v8 ignore next -- private constructor prevents direct instantiation */
	private constructor() {}

	/**
	 * Format a single changeset into a changelog release line.
	 *
	 * @remarks
	 * Parses the changeset summary for a conventional commit prefix
	 * (e.g., `"feat: ..."`, `"fix!: ..."`), resolves the corresponding
	 * {@link SectionCategory}, and produces a markdown bullet item with
	 * optional GitHub metadata (author, PR link, commit hash).
	 *
	 * @param changeset - The changeset to format, including its `id`, `summary`,
	 *   `releases` array, and optional `commit` hash
	 * @param versionType - The semantic version bump type (`"major"`, `"minor"`, or `"patch"`)
	 * @param options - Configuration object; must include `repo` in `"owner/repo"` format.
	 *   Pass `null` to use defaults (no GitHub link resolution).
	 * @returns A promise resolving to the formatted markdown string
	 */
	static async formatReleaseLine(
		changeset: NewChangesetWithCommit,
		versionType: VersionType,
		options: Record<string, unknown> | null,
	): Promise<string> {
		return changelogFunctions.getReleaseLine(changeset, versionType, options);
	}

	/**
	 * Format dependency update release lines into a markdown table.
	 *
	 * @remarks
	 * Generates a structured dependency table showing package names,
	 * version transitions, and dependency types. The table is placed
	 * under the "Dependencies" section heading in the changelog.
	 *
	 * @param changesets - The changesets that triggered the dependency updates
	 * @param dependenciesUpdated - Array of updated dependencies with their
	 *   old/new versions and package metadata
	 * @param options - Configuration object; must include `repo` in `"owner/repo"` format.
	 *   Pass `null` to use defaults.
	 * @returns A promise resolving to the formatted markdown string containing
	 *   the dependency update table
	 */
	static async formatDependencyReleaseLine(
		changesets: NewChangesetWithCommit[],
		dependenciesUpdated: ModCompWithPackage[],
		options: Record<string, unknown> | null,
	): Promise<string> {
		return changelogFunctions.getDependencyReleaseLine(changesets, dependenciesUpdated, options);
	}
}
