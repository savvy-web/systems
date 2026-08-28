/**
 * Result schemas for DepsRegen: the side-effect-free regen plan and the result
 * of applying it.
 *
 */

import { Schema } from "effect";
import { DependencyTableSchema } from "./dependency-table.js";

const RegenDeleteEntrySchema = Schema.Struct({
	file: Schema.String,
	package: Schema.String,
}).annotate({ identifier: "RegenDeleteEntry" });

const WorkspaceDependencyDiffPayloadSchema = Schema.Struct({
	package: Schema.String,
	relativePath: Schema.String,
	rows: DependencyTableSchema,
}).annotate({ identifier: "WorkspaceDependencyDiffPayload" });

const RegenWriteEntrySchema = Schema.Struct({
	file: Schema.String,
	package: Schema.String,
	diff: WorkspaceDependencyDiffPayloadSchema,
}).annotate({ identifier: "RegenWriteEntry" });

/**
 * A prose-only changeset that coexists with a deps-regen run (informational).
 *
 * @public
 */
export const CoexistingChangesetSchema = Schema.Struct({
	/** Absolute path of the untouched prose changeset. */
	file: Schema.String,
	/** In-scope packages released by this changeset's frontmatter. */
	packages: Schema.Array(Schema.String),
}).annotate({ identifier: "CoexistingChangeset" });

/**
 * A prose-only changeset that coexists with a deps-regen run (informational).
 *
 * @public
 */
export type CoexistingChangeset = Schema.Schema.Type<typeof CoexistingChangesetSchema>;

/**
 * Complete side-effect-free deps-regen plan.
 *
 * @public
 */
export const RegenPlanSchema = Schema.Struct({
	toDelete: Schema.Array(RegenDeleteEntrySchema),
	toWrite: Schema.Array(RegenWriteEntrySchema),
	skippedMixed: Schema.Array(Schema.String),
	coexisting: Schema.Array(CoexistingChangesetSchema),
}).annotate({ identifier: "RegenPlan" });

/**
 * Complete side-effect-free deps-regen plan.
 *
 * @public
 */
export type RegenPlan = Schema.Schema.Type<typeof RegenPlanSchema>;

/**
 * Result of applying a {@link RegenPlan}.
 *
 * @public
 */
export const RegenResultSchema = Schema.Struct({
	deleted: Schema.Array(Schema.String),
	written: Schema.Array(Schema.String),
	skippedMixed: Schema.Array(Schema.String),
	coexisting: Schema.Array(CoexistingChangesetSchema),
}).annotate({ identifier: "RegenResult" });

/**
 * Result of applying a {@link RegenPlan}.
 *
 * @public
 */
export type RegenResult = Schema.Schema.Type<typeof RegenResultSchema>;
