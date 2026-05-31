/**
 * Effect schemas for changeset entries and dependency updates.
 *
 * @remarks
 * These schemas define the canonical representation of changeset data
 * consumed by the changelog formatter (Layer 2) and validated by the
 * remark-lint pre-validation layer (Layer 1). They enforce constraints
 * such as summary length limits and valid dependency types at system
 * boundaries.
 *
 * @see {@link https://github.com/changesets/changesets | Changesets documentation}
 * @see {@link https://effect.website/docs/schema/introduction | Effect Schema documentation}
 *
 * @packageDocumentation
 */

import { Schema } from "effect";
import { CommitHashSchema } from "./git.js";
import { NonEmptyString } from "./primitives.js";

/**
 * Schema for a changeset summary (1--1000 characters).
 *
 * @remarks
 * Enforces that every changeset has a non-empty summary and caps length
 * at 1000 characters. Longer descriptions should go in the changeset body,
 * not the summary line. Validation messages guide users toward correct usage.
 *
 * @example
 * ```typescript
 * import { Schema } from "effect";
 * import { ChangesetSummarySchema } from "@savvy-web/changesets";
 *
 * // Succeeds — valid summary
 * const summary = Schema.decodeUnknownSync(ChangesetSummarySchema)(
 * 	"Fix authentication timeout in login flow"
 * );
 *
 * // Throws ParseError — empty string
 * Schema.decodeUnknownSync(ChangesetSummarySchema)("");
 * ```
 *
 * @public
 */
export const ChangesetSummarySchema = Schema.String.pipe(
	Schema.minLength(1, {
		message: () =>
			'Changeset summary cannot be empty. Provide a 1-1000 character description of the change (e.g., "Fix authentication timeout in login flow")',
	}),
	Schema.maxLength(1000, {
		message: () =>
			"Changeset summary exceeds the 1000 character limit. Shorten the summary to at most 1000 characters — use the changeset body for additional details",
	}),
);

/**
 * Schema for a changeset object.
 *
 * @remarks
 * Represents a single changeset entry as consumed by the changelog formatter.
 * The `summary` is the human-readable description, `id` is a unique identifier
 * (typically the changeset filename without extension), and `commit` is the
 * optional git SHA that introduced the changeset.
 *
 * @example
 * ```typescript
 * import { Schema } from "effect";
 * import { ChangesetSchema } from "@savvy-web/changesets";
 * import type { Changeset } from "@savvy-web/changesets";
 *
 * const changeset: Changeset = Schema.decodeUnknownSync(ChangesetSchema)({
 * 	summary: "Add retry logic to API client",
 * 	id: "brave-dogs-laugh",
 * 	commit: "a1b2c3d",
 * });
 * ```
 *
 * @see {@link Changeset} for the inferred TypeScript type
 * @see {@link ChangesetSummarySchema} for summary validation rules
 * @see {@link CommitHashSchema} for commit hash format requirements
 *
 * @public
 */
export const ChangesetSchema = Schema.Struct({
	/** The changeset summary text. */
	summary: ChangesetSummarySchema,
	/** Unique changeset identifier. */
	id: Schema.String,
	/** Git commit hash associated with this changeset. */
	commit: Schema.optional(CommitHashSchema),
});

/**
 * Inferred type for {@link ChangesetSchema}.
 *
 * @remarks
 * Use this interface when you need to type a variable or parameter as a
 * decoded changeset object. It is structurally equivalent to the output
 * of `Schema.decodeUnknownSync(ChangesetSchema)(...)`.
 *
 * @public
 */
export interface Changeset extends Schema.Schema.Type<typeof ChangesetSchema> {}

/**
 * Schema for npm dependency types.
 *
 * @remarks
 * Represents the four standard `package.json` dependency fields using their
 * plural key names as they appear in the manifest. For the singular,
 * table-oriented variant that includes `workspace` and `config` types,
 * see {@link DependencyTableTypeSchema}.
 *
 * @example
 * ```typescript
 * import { Schema } from "effect";
 * import { DependencyTypeSchema } from "@savvy-web/changesets";
 * import type { DependencyType } from "@savvy-web/changesets";
 *
 * const depType: DependencyType = Schema.decodeUnknownSync(DependencyTypeSchema)(
 * 	"devDependencies"
 * );
 * ```
 *
 * @see {@link DependencyTableTypeSchema} for the extended singular-form variant
 *
 * @public
 */
export const DependencyTypeSchema = Schema.Literal(
	"dependencies",
	"devDependencies",
	"peerDependencies",
	"optionalDependencies",
);

/**
 * Inferred type for {@link DependencyTypeSchema}.
 *
 * @remarks
 * One of `"dependencies"`, `"devDependencies"`, `"peerDependencies"`,
 * or `"optionalDependencies"`.
 *
 * @public
 */
export type DependencyType = typeof DependencyTypeSchema.Type;

/**
 * Schema for a dependency update entry.
 *
 * @remarks
 * Represents a single dependency version change as reported by
 * the Changesets API. Captures the package name, which dependency
 * field it belongs to, and the old and new version strings.
 *
 * @example
 * ```typescript
 * import { Schema } from "effect";
 * import { DependencyUpdateSchema } from "@savvy-web/changesets";
 * import type { DependencyUpdate } from "@savvy-web/changesets";
 *
 * const update: DependencyUpdate = Schema.decodeUnknownSync(DependencyUpdateSchema)({
 * 	name: "effect",
 * 	type: "dependencies",
 * 	oldVersion: "3.18.0",
 * 	newVersion: "3.19.1",
 * });
 * ```
 *
 * @see {@link DependencyUpdate} for the inferred TypeScript type
 * @see {@link DependencyTableRowSchema} for the table-formatted variant
 *
 * @public
 */
export const DependencyUpdateSchema = Schema.Struct({
	/** Package name (must be non-empty). */
	name: NonEmptyString.annotations({
		message: () => "Package name cannot be empty",
	}),
	/** npm dependency type. */
	type: DependencyTypeSchema,
	/** Previous version string. */
	oldVersion: Schema.String,
	/** New version string. */
	newVersion: Schema.String,
});

/**
 * Inferred type for {@link DependencyUpdateSchema}.
 *
 * @remarks
 * Use this interface when you need to type a variable or parameter as a
 * decoded dependency update object.
 *
 * @public
 */
export interface DependencyUpdate extends Schema.Schema.Type<typeof DependencyUpdateSchema> {}
