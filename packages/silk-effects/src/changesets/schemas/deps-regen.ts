/**
 * Result schemas for DepsRegen: the side-effect-free regen plan and the result
 * of applying it.
 *
 */

import { Schema } from "effect";
import { DependencyActionSchema, DependencyTableTypeSchema } from "./dependency-table.js";
import { NonEmptyString } from "./primitives.js";

const RegenDeleteEntrySchema = Schema.Struct({
	file: Schema.String,
	package: Schema.String,
}).annotate({ identifier: "RegenDeleteEntry" });

/**
 * One dependency-diff row emitted by the deps-regen planner.
 *
 * @remarks
 * `computeWorkspaceDependencyDiffs` intentionally falls back to raw unresolved
 * specifier strings (`*`, `>=5.7.0`, `^1.2`, `latest`, etc.). This in-memory
 * plan schema therefore accepts any non-empty `from`/`to` cell instead of the
 * stricter changelog-table version pattern.
 *
 * @public
 */
export const RegenDiffRowSchema = Schema.Struct({
	dependency: NonEmptyString,
	type: DependencyTableTypeSchema,
	action: DependencyActionSchema,
	from: NonEmptyString,
	to: NonEmptyString,
}).annotate({ identifier: "RegenDiffRow" });

/**
 * One dependency-diff row emitted by the deps-regen planner.
 *
 * @public
 */
export type RegenDiffRow = Schema.Schema.Type<typeof RegenDiffRowSchema>;

const WorkspaceDependencyDiffPayloadSchema = Schema.Struct({
	package: Schema.String,
	relativePath: Schema.String,
	rows: Schema.Array(RegenDiffRowSchema).check(Schema.isMinLength(1)),
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
