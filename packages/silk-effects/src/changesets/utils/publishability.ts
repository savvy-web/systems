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
 * `root` is passed through verbatim to `detector.detect(pkg, root)` for every
 * package — it must be the project root (the directory containing
 * `.changeset/`), NOT the individual package's directory. The vanilla
 * `PublishabilityDetectorLive` and plain `SilkPublishabilityDetectorLive`
 * both ignore this argument, but the ignore/mode-aware
 * `PublishabilityDetectorAdaptiveLive` reads `.changeset/config.json`
 * relative to it, so passing a package subdirectory silently makes every
 * package resolve to "not publishable". Mirrors
 * {@link SilkPublishability.listPublishable}, which takes the same
 * single-root parameter for the same reason.
 *
 * @param packages - The workspace packages to evaluate
 * @param root - Absolute path to the project root containing `.changeset/`
 * @returns An Effect yielding a `Set` of publishable package names
 *
 * @public
 */
export function listPublishablePackageNames(
	packages: ReadonlyArray<WorkspacePackage>,
	root: string,
): Effect.Effect<ReadonlySet<string>, never, PublishabilityDetector> {
	return Effect.gen(function* () {
		const detector = yield* PublishabilityDetector;
		const names = new Set<string>();
		for (const pkg of packages) {
			const targets = yield* detector.detect(pkg, root);
			if (targets.length > 0) names.add(pkg.name);
		}
		return names;
	});
}
