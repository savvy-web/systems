/**
 * Section category schema and type definitions.
 *
 * @remarks
 * Section categories define how changes are grouped and ordered in release
 * notes and CHANGELOGs. Each category maps conventional commit types to a
 * display heading with a priority for ordering. Categories are used across
 * all three processing layers: remark-lint pre-validation (Layer 1),
 * changelog formatting (Layer 2), and remark-transform post-processing
 * (Layer 3).
 *
 * @see {@link CATEGORIES} for the predefined list of 13 section categories
 * @see {@link resolveCommitType} for mapping commit types to categories
 * @see {@link https://effect.website/docs/schema/introduction | Effect Schema documentation}
 *
 * @packageDocumentation
 */

import { Schema } from "effect";

/**
 * Schema for a section category that defines how changes are grouped in release notes.
 *
 * @remarks
 * A section category has four fields:
 * - `heading` -- the display heading used in CHANGELOG output (e.g., `"Features"`, `"Bug Fixes"`)
 * - `priority` -- an integer controlling display order (lower = higher priority)
 * - `commitTypes` -- conventional commit type prefixes that map to this category (e.g., `["feat"]`)
 * - `description` -- a brief human-readable description for documentation
 *
 * Categories with an empty `commitTypes` array are resolved through other means:
 * `BREAKING_CHANGES` is resolved via the `!` suffix on any commit type, and
 * `OTHER` is the fallback for unrecognized types.
 *
 * @example
 * ```typescript
 * import { Schema } from "effect";
 * import { SectionCategorySchema } from "@savvy-web/changesets";
 * import type { SectionCategory } from "@savvy-web/changesets";
 *
 * const category: SectionCategory = Schema.decodeUnknownSync(SectionCategorySchema)({
 * 	heading: "Features",
 * 	priority: 2,
 * 	commitTypes: ["feat"],
 * 	description: "New functionality",
 * });
 * ```
 *
 * @see {@link SectionCategory} for the inferred TypeScript type
 * @see {@link CATEGORIES} for all predefined categories
 *
 * @public
 */
export const SectionCategorySchema = Schema.Struct({
	/** Display heading used in CHANGELOG output. */
	heading: Schema.String,
	/** Priority for ordering (lower = higher priority). */
	priority: Schema.Number,
	/** Conventional commit types that map to this category. */
	commitTypes: Schema.Array(Schema.String),
	/** Brief description for documentation. */
	description: Schema.String,
});

/**
 * A section category defines how changes are grouped in release notes.
 *
 * @remarks
 * Inferred from {@link SectionCategorySchema}. Use this type to annotate
 * variables and parameters that hold category data.
 *
 * @public
 */
export interface SectionCategory extends Schema.Schema.Type<typeof SectionCategorySchema> {}
