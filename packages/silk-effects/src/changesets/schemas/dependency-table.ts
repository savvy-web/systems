/**
 * Effect schemas for structured dependency table entries.
 *
 * @remarks
 * These schemas define the canonical representation for dependency
 * changes tracked as markdown tables in changeset files and CHANGELOGs.
 * The table format provides a richer view than {@link DependencyUpdateSchema}
 * by supporting singular dependency type names, workspace/config types,
 * and explicit add/update/remove actions.
 *
 * A dependency table row looks like this in a CHANGELOG:
 *
 * | Dependency | Type | Action | From | To |
 * |---|---|---|---|---|
 * | effect | dependency | updated | 3.18.0 | 3.19.1 |
 *
 * @see {@link DependencyUpdateSchema} for the simpler Changesets API format
 * @see {@link https://effect.website/docs/schema/introduction | Effect Schema documentation}
 *
 * @packageDocumentation
 */

import { Schema } from "effect";
import { NonEmptyString } from "./primitives.js";

/**
 * Valid dependency table actions.
 *
 * @remarks
 * Represents the three possible operations on a dependency: `"added"` for
 * new dependencies, `"updated"` for version changes, and `"removed"` for
 * deletions. Used in the "Action" column of dependency tables.
 *
 * @example
 * ```typescript
 * import { Schema } from "effect";
 * import { DependencyActionSchema } from "@savvy-web/changesets";
 * import type { DependencyAction } from "@savvy-web/changesets";
 *
 * const action: DependencyAction = Schema.decodeUnknownSync(DependencyActionSchema)("updated");
 * ```
 *
 * @public
 */
export const DependencyActionSchema = Schema.Literal("added", "updated", "removed");

/**
 * Inferred type for {@link DependencyActionSchema}.
 *
 * @remarks
 * One of `"added"`, `"updated"`, or `"removed"`.
 *
 * @public
 */
export type DependencyAction = typeof DependencyActionSchema.Type;

/**
 * Extended dependency types for table format.
 *
 * @remarks
 * Unlike {@link DependencyTypeSchema} (which uses plural npm field names like
 * `"dependencies"`), this schema uses singular forms (`"dependency"`) and adds
 * two additional types: `"workspace"` for monorepo workspace references and
 * `"config"` for configuration toolchain updates (e.g., ESLint, TypeScript).
 *
 * @example
 * ```typescript
 * import { Schema } from "effect";
 * import { DependencyTableTypeSchema } from "@savvy-web/changesets";
 * import type { DependencyTableType } from "@savvy-web/changesets";
 *
 * const tableType: DependencyTableType = Schema.decodeUnknownSync(
 * 	DependencyTableTypeSchema
 * )("workspace");
 * ```
 *
 * @see {@link DependencyTypeSchema} for the plural npm-field variant
 *
 * @public
 */
export const DependencyTableTypeSchema = Schema.Literal(
	"dependency",
	"devDependency",
	"peerDependency",
	"optionalDependency",
	"workspace",
	"config",
);

/**
 * Inferred type for {@link DependencyTableTypeSchema}.
 *
 * @remarks
 * One of `"dependency"`, `"devDependency"`, `"peerDependency"`,
 * `"optionalDependency"`, `"workspace"`, or `"config"`.
 *
 * @public
 */
export type DependencyTableType = typeof DependencyTableTypeSchema.Type;

/**
 * Version string or em dash (U+2014) sentinel for added/removed entries.
 *
 * @remarks
 * Accepts either a semver-like version string (with optional `~` or `^`
 * prefix and pre-release/build suffixes) or the em dash character `\u2014`
 * which serves as a sentinel: the "From" column uses `\u2014` for newly
 * added dependencies, and the "To" column uses it for removed ones.
 *
 * @example
 * ```typescript
 * import { Schema } from "effect";
 * import { VersionOrEmptySchema } from "@savvy-web/changesets";
 *
 * // Succeeds — semver version
 * Schema.decodeUnknownSync(VersionOrEmptySchema)("^3.19.1");
 *
 * // Succeeds — em dash sentinel for "no version"
 * Schema.decodeUnknownSync(VersionOrEmptySchema)("\u2014");
 *
 * // Throws ParseError — arbitrary text
 * Schema.decodeUnknownSync(VersionOrEmptySchema)("latest");
 * ```
 *
 * @public
 */
export const VersionOrEmptySchema = Schema.String.pipe(
	Schema.pattern(/^(\u2014|[~^]?\d+\.\d+\.\d+(?:[-+.][\w.+-]*)?)$/),
);

/**
 * Schema for a single dependency table row.
 *
 * @remarks
 * Represents one row of a dependency update table in a CHANGELOG.
 * Each row captures the dependency name, its type, the change action,
 * and the "from" and "to" version strings. For added dependencies the
 * `from` field is an em dash; for removed dependencies the `to` field
 * is an em dash.
 *
 * @example
 * ```typescript
 * import { Schema } from "effect";
 * import { DependencyTableRowSchema } from "@savvy-web/changesets";
 * import type { DependencyTableRow } from "@savvy-web/changesets";
 *
 * const row: DependencyTableRow = Schema.decodeUnknownSync(DependencyTableRowSchema)({
 * 	dependency: "effect",
 * 	type: "dependency",
 * 	action: "updated",
 * 	from: "3.18.0",
 * 	to: "3.19.1",
 * });
 *
 * // Newly added dependency — "from" is em dash
 * const addedRow: DependencyTableRow = Schema.decodeUnknownSync(DependencyTableRowSchema)({
 * 	dependency: "@effect/cli",
 * 	type: "dependency",
 * 	action: "added",
 * 	from: "\u2014",
 * 	to: "0.50.0",
 * });
 * ```
 *
 * @see {@link DependencyTableRow} for the inferred TypeScript type
 * @see {@link DependencyTableSchema} for a non-empty array of rows
 *
 * @public
 */
export const DependencyTableRowSchema = Schema.Struct({
	/** Package or toolchain name. */
	dependency: NonEmptyString,
	/** Dependency type. */
	type: DependencyTableTypeSchema,
	/** Change action. */
	action: DependencyActionSchema,
	/** Previous version (em dash for added). */
	from: VersionOrEmptySchema,
	/** New version (em dash for removed). */
	to: VersionOrEmptySchema,
});

/**
 * Inferred type for {@link DependencyTableRowSchema}.
 *
 * @public
 */
export interface DependencyTableRow extends Schema.Schema.Type<typeof DependencyTableRowSchema> {}

/**
 * Schema for a dependency table (non-empty array of rows).
 *
 * @remarks
 * Validates that the table contains at least one row. Used to represent
 * the full dependency update table in a changeset or CHANGELOG entry.
 *
 * @example
 * ```typescript
 * import { Schema } from "effect";
 * import { DependencyTableSchema } from "@savvy-web/changesets";
 *
 * const table = Schema.decodeUnknownSync(DependencyTableSchema)([
 * 	{
 * 		dependency: "effect",
 * 		type: "dependency",
 * 		action: "updated",
 * 		from: "3.18.0",
 * 		to: "3.19.1",
 * 	},
 * 	{
 * 		dependency: "typescript",
 * 		type: "config",
 * 		action: "updated",
 * 		from: "5.6.0",
 * 		to: "5.7.2",
 * 	},
 * ]);
 *
 * // Throws ParseError — empty array
 * Schema.decodeUnknownSync(DependencyTableSchema)([]);
 * ```
 *
 * @see {@link DependencyTableRowSchema} for the individual row schema
 *
 * @public
 */
export const DependencyTableSchema = Schema.Array(DependencyTableRowSchema).pipe(Schema.minItems(1));
