/**
 * Publishability helpers for the changeset CLI commands.
 *
 * @remarks
 * Provides `listPublishablePackageNames`, a convenience wrapper around
 * {@link SilkPublishability} that returns a `Set<string>` of
 * publishable package names. Used by the `deps detect` and `deps regen`
 * commands to filter out workspace packages whose dependency changes
 * would never reach a release.
 *
 */

import { Effect } from "effect";
import type { WorkspacePackage } from "workspaces-effect";
import { PublishabilityDetector } from "workspaces-effect";

/**
 * Compute the set of currently-publishable workspace package names.
 *
 * @remarks
 * Uses the currently-active {@link SilkPublishability} — wire the
 * {@link SilkPublishabilityDetectorLive} layer to get silk semantics.
 *
 * @param packages - The workspace packages to evaluate
 * @returns An Effect yielding a `Set` of publishable package names
 *
 * @public
 */
export function listPublishablePackageNames(
	packages: ReadonlyArray<WorkspacePackage>,
): Effect.Effect<ReadonlySet<string>, never, PublishabilityDetector> {
	return Effect.gen(function* () {
		const detector = yield* PublishabilityDetector;
		const names = new Set<string>();
		for (const pkg of packages) {
			const targets = yield* detector.detect(pkg, pkg.path);
			if (targets.length > 0) names.add(pkg.name);
		}
		return names;
	});
}
