/**
 * The workspace's package names, for the changeset linter's
 * `changeset-known-package` (CF004) rule.
 *
 * @internal
 */

import { WorkspaceDiscovery } from "@effected/workspaces";
import { Effect, Option } from "effect";

/**
 * Discover the names of the workspace packages around `from`.
 *
 * @remarks
 * Succeeds with `undefined` when no `WorkspaceDiscovery` is provided or the
 * directory is not inside a discoverable workspace. The linter then skips
 * CF004 and still runs every other rule: a changeset directory outside a
 * workspace stays lintable.
 *
 * @param from - A directory inside the workspace (the changeset directory)
 * @returns The package names, or `undefined` when they cannot be discovered
 *
 * @internal
 */
export const workspacePackageNames = (from: string): Effect.Effect<ReadonlyArray<string> | undefined> =>
	Effect.gen(function* () {
		const discovery = yield* Effect.serviceOption(WorkspaceDiscovery);
		if (Option.isNone(discovery)) return undefined;
		return yield* discovery.value.listPackagesIn(from).pipe(
			Effect.map((packages) => packages.map((pkg) => pkg.name)),
			Effect.orElseSucceed(() => undefined),
		);
	});
