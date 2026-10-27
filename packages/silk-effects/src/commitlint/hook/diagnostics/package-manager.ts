/**
 * Package manager detection for the commit-time hooks.
 *
 * Delegates to `@effected/workspaces`' `detectPackageManagerSync` — the same
 * detector `Lint`'s `Command.detectPackageManager` runs — so silk-effects has
 * one answer to "which manager owns this root". The kit refuses to guess when
 * no evidence matches (and fails on an unreadable root `package.json`); the
 * hook hints still need a command to print, so those cases fall back to `npm`.
 *
 * @internal
 */
import { detectPackageManagerSync } from "@effected/workspaces";
import { nodeSyncOps } from "@effected/workspaces/node-sync";
import { Result } from "effect";

export type PackageManager = "pnpm" | "yarn" | "bun" | "npm";

/**
 * Detect the package manager owning `root`, falling back to `npm`.
 *
 * @remarks
 * Precedence is the kit's (`PackageManagerDetector`): `pnpm-workspace.yaml`,
 * then a bun or yarn lockfile only when a manifest field also names that
 * manager, then `package.json#workspaces` (npm), `pnpm-lock.yaml`,
 * `package-lock.json`, and finally `devEngines.packageManager` over the
 * top-level `packageManager` field. `root` is probed as given, without ascent.
 *
 * @param root - The directory to probe
 * @returns The detected manager, or `"npm"` when none can be attributed
 */
export async function detectPackageManager(root: string): Promise<PackageManager> {
	const detected = detectPackageManagerSync(root, nodeSyncOps);
	return Result.isSuccess(detected) ? detected.success.name : "npm";
}
