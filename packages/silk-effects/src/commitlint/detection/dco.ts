/**
 * DCO (Developer Certificate of Origin) detection module.
 *
 * @internal
 */
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

/** Filename for the DCO file that indicates signoff is required. */
const DCO_FILENAME = "DCO";

/** Markers that indicate a project root directory. */
const ROOT_MARKERS = ["pnpm-workspace.yaml", ".git", "package.json"];

/**
 * Walk up the directory tree to find the project root.
 *
 * @param cwd - Starting directory
 * @returns Project root path or null if not found
 *
 * @internal
 */
function findProjectRoot(cwd: string): string | null {
	let dir = resolve(cwd);

	while (true) {
		for (const marker of ROOT_MARKERS) {
			if (existsSync(join(dir, marker))) {
				return dir;
			}
		}
		const parent = dirname(dir);
		if (parent === dir) {
			return null;
		}
		dir = parent;
	}
}

/**
 * Detect if DCO signoff should be required.
 *
 * @remarks
 * Checks for the presence of a DCO file at the repository root.
 * Walks up the directory tree to find the project root by looking
 * for workspace markers (pnpm-workspace.yaml, .git, package.json).
 *
 * @param cwd - Working directory (defaults to process.cwd())
 * @returns `true` if DCO file exists at repo root, `false` otherwise
 *
 * @public
 */
export function detectDCO(cwd: string = process.cwd()): boolean {
	const repoRoot = findProjectRoot(cwd);
	const searchDir = repoRoot ?? cwd;
	return existsSync(join(searchDir, DCO_FILENAME));
}
