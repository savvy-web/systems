/**
 * Workspace-aware discovery utilities.
 *
 * @remarks
 * Wraps the synchronous APIs from `workspaces-effect` with caching.
 * Workspace layout does not change during a lint-staged run, so
 * results are cached on first access. Use `resetWorkspaceCache()`
 * in tests to clear state between runs.
 */

import { dirname } from "node:path";
import { findWorkspaceRootSync, getWorkspacePackagesSync } from "workspaces-effect";

/**
 * Minimal shape of a workspace package needed by this module.
 *
 * @remarks
 * Avoids importing the full WorkspacePackage Schema.Class from
 * workspaces-effect, keeping the sync boundary clean.
 */
export interface WorkspacePackageInfo {
	readonly name: string;
	readonly path: string;
}

/** Sentinel indicating "not yet resolved". */
const UNRESOLVED = Symbol("unresolved");

let cachedRoot: string | null | typeof UNRESOLVED = UNRESOLVED;
let cachedPackages: WorkspacePackageInfo[] | null | typeof UNRESOLVED = UNRESOLVED;
let cachedPaths: string[] | typeof UNRESOLVED = UNRESOLVED;

/**
 * Get the workspace root directory.
 *
 * @returns Absolute path to workspace root, or null if not in a workspace
 */
export function getWorkspaceRoot(): string | null {
	if (cachedRoot !== UNRESOLVED) return cachedRoot;
	cachedRoot = findWorkspaceRootSync() ?? null;
	return cachedRoot;
}

/**
 * Get all leaf workspace packages (excludes root).
 *
 * @returns Array of workspace packages, or null if not in a workspace
 */
export function getWorkspacePackages(): WorkspacePackageInfo[] | null {
	if (cachedPackages !== UNRESOLVED) return cachedPackages;

	const root = getWorkspaceRoot();
	if (root === null) {
		cachedPackages = null;
		return null;
	}

	const all = getWorkspacePackagesSync(root) ?? [];
	cachedPackages = all.filter((pkg) => pkg.path !== root);
	return cachedPackages;
}

/**
 * Get absolute paths of all leaf workspace package directories.
 *
 * @returns Array of absolute paths, empty if not in a workspace
 */
export function getWorkspacePackagePaths(): string[] {
	if (cachedPaths !== UNRESOLVED) return cachedPaths;

	const packages = getWorkspacePackages();
	cachedPaths = packages?.map((pkg) => pkg.path) ?? [];
	return cachedPaths;
}

/**
 * Check if a file path is at a workspace root or leaf workspace root.
 *
 * @remarks
 * Compares the file's parent directory against the workspace root
 * and all leaf workspace roots. Returns true as a permissive
 * fallback when not in a workspace, so single-package repos
 * continue to work.
 *
 * @param filePath - Absolute path to the file
 * @returns true if the file is at a workspace or leaf root
 */
export function isWorkspacePackagePath(filePath: string): boolean {
	const root = getWorkspaceRoot();
	if (root === null) return true; // permissive fallback

	const dir = dirname(filePath);
	if (dir === root) return true;

	const packagePaths = getWorkspacePackagePaths();
	return packagePaths.includes(dir);
}

/**
 * Clear all cached workspace data.
 *
 * @remarks
 * Call this in test teardown to ensure clean state between tests.
 */
export function resetWorkspaceCache(): void {
	cachedRoot = UNRESOLVED;
	cachedPackages = UNRESOLVED;
	cachedPaths = UNRESOLVED;
}
