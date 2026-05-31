/**
 * Class-based API wrapper for section categories.
 *
 * Provides a static class interface that bridges to the underlying
 * Effect-native category functions for higher-level consumers.
 *
 * @internal
 */

import {
	BREAKING_CHANGES,
	BUG_FIXES,
	BUILD_SYSTEM,
	CATEGORIES,
	CI,
	DEPENDENCIES,
	DOCUMENTATION,
	FEATURES,
	MAINTENANCE,
	OTHER,
	PERFORMANCE,
	REFACTORING,
	REVERTS,
	TESTS,
	allHeadings,
	fromHeading,
	isValidHeading,
	resolveCommitType,
} from "../categories/index.js";
import type { SectionCategory } from "../categories/types.js";

/**
 * Static class wrapper for section category operations.
 *
 * Provides methods for resolving conventional commit types to changelog
 * section categories, validating section headings, and accessing the
 * canonical set of 13 section categories used throughout the pipeline.
 *
 * @remarks
 * This class wraps the pure functions and constants from the internal
 * `categories/` module. Each {@link SectionCategory} is defined by the
 * {@link SectionCategorySchema} Effect Schema, which provides runtime
 * validation at system boundaries. The class itself is stateless; all
 * methods and properties are `static`.
 *
 * Categories control how changelog entries are grouped and ordered.
 * Lower priority numbers appear first in the output. The 13 built-in
 * categories cover all conventional commit types plus special cases
 * like dependency updates and breaking changes.
 *
 * @example Looking up categories from commit metadata
 * ```typescript
 * import { Categories } from "\@savvy-web/changesets";
 * import type { SectionCategory } from "\@savvy-web/changesets";
 *
 * // Resolve a conventional commit type to its category
 * const feature: SectionCategory = Categories.fromCommitType("feat");
 * // feature.heading === "Features"
 * // feature.priority === 2
 *
 * // Breaking changes always win regardless of commit type
 * const breaking: SectionCategory = Categories.fromCommitType("fix", undefined, true);
 * // breaking.heading === "Breaking Changes"
 * // breaking.priority === 1
 *
 * // The special scope "deps" on "chore" maps to Dependencies
 * const deps: SectionCategory = Categories.fromCommitType("chore", "deps");
 * // deps.heading === "Dependencies"
 * ```
 *
 * @example Validating section headings
 * ```typescript
 * import { Categories } from "\@savvy-web/changesets";
 *
 * const headings: readonly string[] = Categories.allHeadings();
 * // ["Breaking Changes", "Features", "Bug Fixes", ...]
 *
 * const valid: boolean = Categories.isValidHeading("Bug Fixes");
 * // true
 *
 * const unknown: boolean = Categories.isValidHeading("Miscellaneous");
 * // false
 * ```
 *
 * @example Reverse-lookup from heading text
 * ```typescript
 * import { Categories } from "\@savvy-web/changesets";
 * import type { SectionCategory } from "\@savvy-web/changesets";
 *
 * const category: SectionCategory | undefined = Categories.fromHeading("Features");
 * if (category) {
 *   const commitTypes: readonly string[] = category.commitTypes;
 *   // ["feat"]
 * }
 * ```
 *
 * @see {@link SectionCategory} for the category shape (heading, priority, commitTypes, description)
 * @see {@link SectionCategorySchema} for the Effect Schema that validates category data
 *
 * @public
 */
export class Categories {
	private constructor() {}

	/**
	 * Breaking changes -- backward-incompatible changes (priority 1).
	 *
	 * @remarks
	 * Mapped from any commit type when the `breaking` flag is `true`.
	 * Always appears first in changelog output.
	 */
	static readonly BREAKING_CHANGES: SectionCategory = BREAKING_CHANGES;

	/**
	 * Features -- new functionality (priority 2).
	 *
	 * @remarks
	 * Mapped from the `feat` commit type.
	 */
	static readonly FEATURES: SectionCategory = FEATURES;

	/**
	 * Bug Fixes -- bug corrections (priority 3).
	 *
	 * @remarks
	 * Mapped from the `fix` commit type.
	 */
	static readonly BUG_FIXES: SectionCategory = BUG_FIXES;

	/**
	 * Performance -- performance improvements (priority 4).
	 *
	 * @remarks
	 * Mapped from the `perf` commit type.
	 */
	static readonly PERFORMANCE: SectionCategory = PERFORMANCE;

	/**
	 * Documentation -- documentation changes (priority 5).
	 *
	 * @remarks
	 * Mapped from the `docs` commit type.
	 */
	static readonly DOCUMENTATION: SectionCategory = DOCUMENTATION;

	/**
	 * Refactoring -- code restructuring (priority 6).
	 *
	 * @remarks
	 * Mapped from the `refactor` commit type.
	 */
	static readonly REFACTORING: SectionCategory = REFACTORING;

	/**
	 * Tests -- test additions or modifications (priority 7).
	 *
	 * @remarks
	 * Mapped from the `test` commit type.
	 */
	static readonly TESTS: SectionCategory = TESTS;

	/**
	 * Build System -- build configuration changes (priority 8).
	 *
	 * @remarks
	 * Mapped from the `build` commit type.
	 */
	static readonly BUILD_SYSTEM: SectionCategory = BUILD_SYSTEM;

	/**
	 * CI -- continuous integration changes (priority 9).
	 *
	 * @remarks
	 * Mapped from the `ci` commit type.
	 */
	static readonly CI: SectionCategory = CI;

	/**
	 * Dependencies -- dependency updates (priority 10).
	 *
	 * @remarks
	 * Mapped from `chore(deps)` and similar dependency-scoped commits.
	 */
	static readonly DEPENDENCIES: SectionCategory = DEPENDENCIES;

	/**
	 * Maintenance -- general maintenance (priority 11).
	 *
	 * @remarks
	 * Mapped from the `chore` commit type (without the `deps` scope).
	 */
	static readonly MAINTENANCE: SectionCategory = MAINTENANCE;

	/**
	 * Reverts -- reverted changes (priority 12).
	 *
	 * @remarks
	 * Mapped from the `revert` commit type.
	 */
	static readonly REVERTS: SectionCategory = REVERTS;

	/**
	 * Other -- uncategorized changes (priority 13).
	 *
	 * @remarks
	 * Fallback category for unrecognized commit types. Always appears
	 * last in changelog output.
	 */
	static readonly OTHER: SectionCategory = OTHER;

	/**
	 * All 13 categories ordered by priority (ascending, 1-13).
	 *
	 * @remarks
	 * This array is frozen and sorted from highest priority (Breaking Changes)
	 * to lowest (Other). Useful for iterating over categories in display order.
	 */
	static readonly ALL: readonly SectionCategory[] = CATEGORIES;

	/**
	 * Resolve a conventional commit type to its section category.
	 *
	 * @remarks
	 * Resolution follows a precedence chain:
	 *
	 * 1. If `breaking` is `true`, always returns {@link Categories.BREAKING_CHANGES}
	 * 2. If `type` is `"chore"` and `scope` is `"deps"`, returns {@link Categories.DEPENDENCIES}
	 * 3. Otherwise, looks up `type` in the `commitTypes` arrays of all categories
	 * 4. Falls back to {@link Categories.OTHER} for unrecognized types
	 *
	 * @param type - The conventional commit type (e.g., `"feat"`, `"fix"`, `"chore"`)
	 * @param scope - Optional commit scope (e.g., `"deps"` from `chore(deps):`)
	 * @param breaking - Whether the commit includes a breaking change indicator (`!`)
	 * @returns The resolved {@link SectionCategory}
	 */
	static fromCommitType(type: string, scope?: string, breaking?: boolean): SectionCategory {
		return resolveCommitType(type, scope, breaking);
	}

	/**
	 * Look up a category by its section heading text.
	 *
	 * @remarks
	 * Comparison is case-insensitive. For example, both `"Bug Fixes"` and
	 * `"bug fixes"` will match {@link Categories.BUG_FIXES}.
	 *
	 * @param heading - The heading text (e.g., `"Features"`, `"Bug Fixes"`)
	 * @returns The matching {@link SectionCategory}, or `undefined` if the heading
	 *   does not correspond to any known category
	 */
	static fromHeading(heading: string): SectionCategory | undefined {
		return fromHeading(heading);
	}

	/**
	 * Get all valid section heading strings in priority order.
	 *
	 * @remarks
	 * Returns the `heading` field from each category in {@link Categories.ALL},
	 * preserving priority order. Useful for building validation sets or
	 * rendering category pickers.
	 *
	 * @returns Readonly array of heading strings (e.g., `["Breaking Changes", "Features", ...]`)
	 */
	static allHeadings(): readonly string[] {
		return allHeadings();
	}

	/**
	 * Check whether a heading string matches a known category.
	 *
	 * @remarks
	 * Comparison is case-insensitive. Equivalent to
	 * `Categories.fromHeading(heading) !== undefined`.
	 *
	 * @param heading - The heading text to validate
	 * @returns `true` if the heading matches a known category, `false` otherwise
	 */
	static isValidHeading(heading: string): boolean {
		return isValidHeading(heading);
	}
}
