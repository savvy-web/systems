import { Schema } from "effect";

/**
 * Bump type for a changeset entry.
 *
 * @public
 */
export const BumpType = Schema.Literals(["major", "minor", "patch"]).annotate({ identifier: "BumpType" });

/**
 * @public
 */
export type BumpType = typeof BumpType.Type;

/**
 * A parsed changeset with package bump mappings and summary.
 *
 * @public
 */
export const Changeset = Schema.Struct({
	id: Schema.String,
	packages: Schema.Array(
		Schema.Struct({
			name: Schema.String,
			bump: BumpType,
		}),
	),
	summary: Schema.String,
}).annotate({ identifier: "Changeset" });

/**
 * @public
 */
export type Changeset = typeof Changeset.Type;

/**
 * A changeset file with path and content.
 *
 * @public
 */
export const ChangesetFile = Schema.Struct({
	path: Schema.String,
	content: Schema.String,
}).annotate({ identifier: "ChangesetFile" });

/**
 * @public
 */
export type ChangesetFile = typeof ChangesetFile.Type;
