/**
 * Derive why a package is releasing with no changesets of its own.
 *
 * @remarks
 * A release whose `changesets` array is empty was forced by workspace
 * coupling — a `fixed` or `linked` version group in the changesets config —
 * or by an engine behavior we do not model. The derived reason feeds the
 * `MaintenanceNotePlugin` so the generated CHANGELOG never ships an empty
 * version block.
 *
 * Pattern matching uses {@link ChangesetConfig.matches} (exact +
 * `"@scope/*"` prefix), the same semantics as changeset ignore patterns.
 *
 * @public
 */

import type { ComprehensiveRelease, Config, ReleasePlan } from "@changesets/types";
import { Schema } from "effect";

import { ChangesetConfig } from "../../services/ChangesetConfig.js";

/**
 * A group co-member whose own changesets forced this release.
 *
 * @public
 */
export const MaintenanceTriggerSchema = Schema.Struct({
	/** Package name of the triggering co-member. */
	name: Schema.String,
	/** The co-member's new version in the same release plan. */
	version: Schema.String,
});

/**
 * A group co-member whose own changesets forced this release.
 *
 * @public
 */
export type MaintenanceTrigger = typeof MaintenanceTriggerSchema.Type;

/**
 * Why a package is releasing with no changesets of its own.
 *
 * @public
 */
export const MaintenanceReasonSchema = Schema.Struct({
	/** Coupling that forced the release; `"unspecified"` when undetermined. */
	kind: Schema.Literals(["fixed", "linked", "unspecified"]),
	/** Triggering co-members; empty for `"unspecified"`. */
	triggers: Schema.Array(MaintenanceTriggerSchema),
});

/**
 * Why a package is releasing with no changesets of its own.
 *
 * @public
 */
export type MaintenanceReason = typeof MaintenanceReasonSchema.Type;

/**
 * Derive the {@link MaintenanceReason} for a release, or `undefined` when the
 * release has its own changesets (not a maintenance release).
 *
 * @param release - The release to classify.
 * @param plan - The full release plan (source of group co-members).
 * @param config - Resolved changesets config (`fixed` / `linked` groups).
 * @returns The reason, or `undefined` for releases with their own changesets.
 *
 * @remarks
 * Group entries are matched with {@link ChangesetConfig.matches} — exact names
 * and trailing `"@scope/*"` prefixes only, a subset of the micromatch globs
 * changesets accepts. A group entry using richer glob syntax (e.g. `"pkg-*"`)
 * will not match here; the release then degrades gracefully to the
 * `"unspecified"` fallback sentence instead of naming its triggers.
 *
 * @public
 */
export function deriveMaintenanceReason(
	release: ComprehensiveRelease,
	plan: ReleasePlan,
	config: Config,
): MaintenanceReason | undefined {
	if (release.changesets.length > 0) return undefined;

	const groupKinds: ReadonlyArray<readonly ["fixed" | "linked", ReadonlyArray<ReadonlyArray<string>>]> = [
		["fixed", config.fixed],
		["linked", config.linked],
	];

	for (const [kind, groups] of groupKinds) {
		for (const group of groups) {
			if (!group.some((pattern) => ChangesetConfig.matches(release.name, pattern))) continue;
			const triggers = plan.releases
				.filter(
					(r) =>
						r.name !== release.name &&
						r.changesets.length > 0 &&
						group.some((pattern) => ChangesetConfig.matches(r.name, pattern)),
				)
				.map((r) => ({ name: r.name, version: r.newVersion }));
			if (triggers.length > 0) return { kind, triggers };
		}
	}

	return { kind: "unspecified", triggers: [] };
}
