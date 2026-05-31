/**
 * Section category definitions and mapping.
 *
 * @remarks
 * Defines the 13 section categories used across all three processing layers
 * of the \@savvy-web/changesets pipeline. Categories map conventional commit
 * types to CHANGELOG section headings with a priority ordering for display.
 *
 * The categories, in priority order, are:
 * 1. Breaking Changes (no commit type -- resolved via `!` suffix)
 * 2. Features (`feat`)
 * 3. Bug Fixes (`fix`)
 * 4. Performance (`perf`)
 * 5. Documentation (`docs`)
 * 6. Refactoring (`refactor`)
 * 7. Tests (`test`)
 * 8. Build System (`build`)
 * 9. CI (`ci`)
 * 10. Dependencies (`deps`, `chore(deps)`)
 * 11. Maintenance (`chore`, `style`)
 * 12. Reverts (`revert`)
 * 13. Other (fallback for unrecognized types)
 *
 * @see {@link SectionCategory} for the category type definition
 * @see {@link SectionCategorySchema} for runtime validation
 *
 * @packageDocumentation
 */

import type { SectionCategory } from "./types.js";

/**
 * Breaking changes -- backward-incompatible changes.
 *
 * @remarks
 * Priority 1 (highest). This category has no associated commit types;
 * it is resolved by the `!` suffix on any conventional commit type
 * (e.g., `feat!:`, `fix!:`). Use {@link resolveCommitType} with
 * `breaking: true` to map to this category.
 *
 * @internal
 */
export const BREAKING_CHANGES: SectionCategory = {
	heading: "Breaking Changes",
	priority: 1,
	commitTypes: [],
	description: "Backward-incompatible changes",
};

/**
 * Features -- new functionality.
 *
 * @remarks
 * Priority 2. Maps from the `feat` conventional commit type.
 *
 * @internal
 */
export const FEATURES: SectionCategory = {
	heading: "Features",
	priority: 2,
	commitTypes: ["feat"],
	description: "New functionality",
};

/**
 * Bug Fixes -- bug corrections.
 *
 * @remarks
 * Priority 3. Maps from the `fix` conventional commit type.
 *
 * @internal
 */
export const BUG_FIXES: SectionCategory = {
	heading: "Bug Fixes",
	priority: 3,
	commitTypes: ["fix"],
	description: "Bug corrections",
};

/**
 * Performance -- performance improvements.
 *
 * @remarks
 * Priority 4. Maps from the `perf` conventional commit type.
 *
 * @internal
 */
export const PERFORMANCE: SectionCategory = {
	heading: "Performance",
	priority: 4,
	commitTypes: ["perf"],
	description: "Performance improvements",
};

/**
 * Documentation -- documentation changes.
 *
 * @remarks
 * Priority 5. Maps from the `docs` conventional commit type.
 *
 * @internal
 */
export const DOCUMENTATION: SectionCategory = {
	heading: "Documentation",
	priority: 5,
	commitTypes: ["docs"],
	description: "Documentation changes",
};

/**
 * Refactoring -- code restructuring without behavior change.
 *
 * @remarks
 * Priority 6. Maps from the `refactor` conventional commit type.
 *
 * @internal
 */
export const REFACTORING: SectionCategory = {
	heading: "Refactoring",
	priority: 6,
	commitTypes: ["refactor"],
	description: "Code restructuring",
};

/**
 * Tests -- test additions or modifications.
 *
 * @remarks
 * Priority 7. Maps from the `test` conventional commit type.
 *
 * @internal
 */
export const TESTS: SectionCategory = {
	heading: "Tests",
	priority: 7,
	commitTypes: ["test"],
	description: "Test additions or modifications",
};

/**
 * Build System -- build configuration changes.
 *
 * @remarks
 * Priority 8. Maps from the `build` conventional commit type.
 *
 * @internal
 */
export const BUILD_SYSTEM: SectionCategory = {
	heading: "Build System",
	priority: 8,
	commitTypes: ["build"],
	description: "Build configuration changes",
};

/**
 * CI -- continuous integration changes.
 *
 * @remarks
 * Priority 9. Maps from the `ci` conventional commit type.
 *
 * @internal
 */
export const CI: SectionCategory = {
	heading: "CI",
	priority: 9,
	commitTypes: ["ci"],
	description: "Continuous integration changes",
};

/**
 * Dependencies -- dependency updates.
 *
 * @remarks
 * Priority 10. Maps from the `deps` conventional commit type and also
 * from `chore(deps)` via the {@link resolveCommitType} function.
 *
 * @internal
 */
export const DEPENDENCIES: SectionCategory = {
	heading: "Dependencies",
	priority: 10,
	commitTypes: ["deps"],
	description: "Dependency updates",
};

/**
 * Maintenance -- general maintenance tasks.
 *
 * @remarks
 * Priority 11. Maps from the `chore` and `style` conventional commit types.
 * Note that `chore(deps)` is redirected to {@link DEPENDENCIES} by
 * {@link resolveCommitType}.
 *
 * @internal
 */
export const MAINTENANCE: SectionCategory = {
	heading: "Maintenance",
	priority: 11,
	commitTypes: ["chore", "style"],
	description: "General maintenance",
};

/**
 * Reverts -- reverted changes.
 *
 * @remarks
 * Priority 12. Maps from the `revert` conventional commit type.
 *
 * @internal
 */
export const REVERTS: SectionCategory = {
	heading: "Reverts",
	priority: 12,
	commitTypes: ["revert"],
	description: "Reverted changes",
};

/**
 * Other -- uncategorized changes.
 *
 * @remarks
 * Priority 13 (lowest). This category has no associated commit types;
 * it serves as the fallback for any commit type not recognized by the
 * category system. Resolved by {@link resolveCommitType} when no other
 * category matches.
 *
 * @internal
 */
export const OTHER: SectionCategory = {
	heading: "Other",
	priority: 13,
	commitTypes: [],
	description: "Uncategorized changes",
};

/**
 * All 13 categories ordered by priority (ascending).
 *
 * @remarks
 * This array provides the canonical ordering for section headings in
 * CHANGELOG output. Breaking Changes appear first, Other appears last.
 * The array is frozen (`as const`) to prevent accidental mutation.
 *
 * @internal
 */
export const CATEGORIES: readonly SectionCategory[] = [
	BREAKING_CHANGES,
	FEATURES,
	BUG_FIXES,
	PERFORMANCE,
	DOCUMENTATION,
	REFACTORING,
	TESTS,
	BUILD_SYSTEM,
	CI,
	DEPENDENCIES,
	MAINTENANCE,
	REVERTS,
	OTHER,
] as const;

/**
 * Set of all valid section heading strings (case-insensitive lookup).
 * Used by Layer 1 (remark-lint) to validate changeset headings.
 */
const headingToCategory = new Map<string, SectionCategory>(CATEGORIES.map((cat) => [cat.heading.toLowerCase(), cat]));

/**
 * Map from commit type string to its category.
 * Handles standard commit types. For `chore(deps)` and breaking `!` suffix,
 * use {@link resolveCommitType} instead.
 */
const commitTypeToCategory = new Map<string, SectionCategory>();
for (const cat of CATEGORIES) {
	for (const commitType of cat.commitTypes) {
		commitTypeToCategory.set(commitType, cat);
	}
}

/**
 * Resolve a conventional commit type (with optional scope and `!` suffix) to a category.
 *
 * @remarks
 * This function implements the full commit-type-to-category mapping logic,
 * including special cases:
 * - Any commit with `breaking: true` maps to {@link BREAKING_CHANGES}
 * - `chore` with scope `deps` maps to {@link DEPENDENCIES} (not Maintenance)
 * - Unrecognized types fall through to {@link OTHER}
 *
 * @param type - The commit type (e.g., `"feat"`, `"fix"`, `"chore"`)
 * @param scope - Optional scope (e.g., `"deps"` in `chore(deps):`)
 * @param breaking - Whether the commit has a `!` suffix indicating a breaking change
 * @returns The resolved section category
 *
 * @internal
 */
export function resolveCommitType(type: string, scope?: string, breaking?: boolean): SectionCategory {
	if (breaking) {
		return BREAKING_CHANGES;
	}

	// chore(deps) and deps map to Dependencies
	if (type === "chore" && scope === "deps") {
		return DEPENDENCIES;
	}

	return commitTypeToCategory.get(type) ?? OTHER;
}

/**
 * Look up a category by its section heading text.
 *
 * @remarks
 * Comparison is case-insensitive: `"features"`, `"Features"`, and
 * `"FEATURES"` all match the Features category.
 *
 * @param heading - The heading text (e.g., `"Features"`, `"Bug Fixes"`)
 * @returns The matching category, or `undefined` if not recognized
 *
 * @internal
 */
export function fromHeading(heading: string): SectionCategory | undefined {
	return headingToCategory.get(heading.toLowerCase());
}

/**
 * Check whether a heading string matches a known category.
 *
 * @remarks
 * Comparison is case-insensitive. Useful for validating that a markdown
 * heading in a changeset file corresponds to a recognized section.
 *
 * @param heading - The heading text to check
 * @returns `true` if the heading matches a known category
 *
 * @internal
 */
export function isValidHeading(heading: string): boolean {
	return headingToCategory.has(heading.toLowerCase());
}

/**
 * Get all valid section heading strings.
 *
 * @remarks
 * Returns the headings in priority order, matching the order of {@link CATEGORIES}.
 * Useful for generating help text or validation error messages that list
 * accepted headings.
 *
 * @returns Array of heading strings (e.g., `["Breaking Changes", "Features", ...]`)
 *
 * @internal
 */
export function allHeadings(): readonly string[] {
	return CATEGORIES.map((cat) => cat.heading);
}
