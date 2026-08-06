import { Schema } from "effect";

/**
 * The kinds of drift {@link ReposDrift} can detect between the four
 * authorities it reconciles: the manifest, `.gitmodules`, the worktree, and
 * `git submodule status`.
 * @public
 */
export const DriftKind = Schema.Literals([
	"urlMismatch",
	"pathMismatch",
	"unregisteredManifestEntry",
	"orphanGitmodulesEntry",
	"missingWorktree",
	"checkoutDiverged",
	"missingShallow",
	"gitmodulesUnparsable",
]);
/** @public */
export type DriftKind = typeof DriftKind.Type;

/**
 * One detected disagreement between two (or more) of the four authorities
 * for a single vendored repo.
 *
 * @remarks
 * `manifestValue`/`observedValue` carry the two disagreeing values when the
 * drift is a value mismatch (`urlMismatch`, `pathMismatch`); other kinds
 * populate whichever side has a value to show (or neither, for
 * `gitmodulesUnparsable`, which is not about one repo).
 * @public
 */
export class RepoDrift extends Schema.Class<RepoDrift>("RepoDrift")({
	name: Schema.String,
	kind: DriftKind,
	detail: Schema.String,
	manifestValue: Schema.optionalKey(Schema.String),
	observedValue: Schema.optionalKey(Schema.String),
}) {}

/**
 * The result of reconciling the manifest, `.gitmodules`, the worktree, and
 * `git submodule status` for every vendored repo.
 * @public
 */
export class ReposDriftReport extends Schema.Class<ReposDriftReport>("ReposDriftReport")({
	drifts: Schema.Array(RepoDrift),
	clean: Schema.Boolean,
}) {}
