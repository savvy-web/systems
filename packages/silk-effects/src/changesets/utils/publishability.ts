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

import type { WorkspacePackage } from "@effected/workspaces";
import { PublishabilityDetector } from "@effected/workspaces";
import { Effect } from "effect";

/**
 * Compute the set of currently-publishable workspace package names.
 *
 * @remarks
 * Uses the currently-active {@link SilkPublishability} — wire the
 * `SilkPublishability.layer` layer to get silk semantics.
 *
 * The kit's `PublishabilityDetector.detect` contract no longer receives the
 * workspace root — the ignore/mode-aware `SilkPublishability.layerAdaptive`
 * derives the `.changeset/config.json` root per package from the package's
 * own discovery coordinates (`pkg.path` ascended by `pkg.relativePath`).
 * The `root` parameter is retained for signature stability
 * but is no longer consulted. Mirrors
 * {@link SilkPublishability.listPublishable}, which keeps the same inert
 * single-root parameter for the same reason.
 *
 * @param packages - The workspace packages to evaluate
 * @param _root - Retained for signature stability; no longer consulted
 * @returns An Effect yielding a `Set` of publishable package names
 *
 * @public
 */
export function listPublishablePackageNames(
	packages: ReadonlyArray<WorkspacePackage>,
	_root: string,
): Effect.Effect<ReadonlySet<string>, never, PublishabilityDetector> {
	return Effect.gen(function* () {
		const detector = yield* PublishabilityDetector;
		const names = new Set<string>();
		for (const pkg of packages) {
			const targets = yield* detector.detect(pkg);
			if (targets.length > 0) names.add(pkg.name);
		}
		return names;
	});
}
