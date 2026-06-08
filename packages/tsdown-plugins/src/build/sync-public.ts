import { copyFileSync, cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";

/** Recursively collect every file path under `dir`, relative to `base`. */
function listFilesRel(dir: string, base: string = dir): string[] {
	const out: string[] = [];
	for (const entry of readdirSync(dir, { withFileTypes: true })) {
		const abs = join(dir, entry.name);
		if (entry.isDirectory()) out.push(...listFilesRel(abs, base));
		else out.push(relative(base, abs));
	}
	return out;
}

/** True when both files exist with identical size and bytes. Size is checked first so the byte read is skipped for the common changed case. */
function sameBytes(a: string, b: string): boolean {
	if (statSync(a).size !== statSync(b).size) return false;
	return readFileSync(a).equals(readFileSync(b));
}

/** Remove empty directories under `dir` (deepest-first); `dir` itself is left in place. */
function pruneEmptyDirs(dir: string): void {
	for (const entry of readdirSync(dir, { withFileTypes: true })) {
		if (!entry.isDirectory()) continue;
		const sub = join(dir, entry.name);
		pruneEmptyDirs(sub);
		if (readdirSync(sub).length === 0) rmSync(sub, { recursive: true, force: true });
	}
}

/**
 * Mirror `sourceDir` into `targetDir`, idempotently.
 *
 * Replaces tsdown's built-in `copy`, whose non-recursive mkdir throws `EEXIST` when the target
 * already exists (re-builds, `prepare`-on-install, concurrent turbo invocations). Behavior:
 *
 * - source absent: no-op.
 * - target absent: copy `sourceDir` wholesale.
 * - target present: copy only files that are new or whose bytes differ, then delete target files
 *   that no longer exist in the source and prune the directories left empty.
 *
 * The byte-diff keeps unchanged files (and their timestamps) untouched, so a large copied asset
 * tree — e.g. the mcp markdown corpus — is not rewritten on every build.
 */
export function syncPublicDir(sourceDir: string, targetDir: string): void {
	if (!existsSync(sourceDir)) return;
	if (!existsSync(targetDir)) {
		cpSync(sourceDir, targetDir, { recursive: true });
		return;
	}

	const sourceFiles = listFilesRel(sourceDir);
	const sourceSet = new Set(sourceFiles);

	// (a) copy new or byte-changed files.
	for (const rel of sourceFiles) {
		const src = join(sourceDir, rel);
		const dst = join(targetDir, rel);
		if (!existsSync(dst) || !sameBytes(src, dst)) {
			mkdirSync(dirname(dst), { recursive: true });
			copyFileSync(src, dst);
		}
	}

	// (b) delete target files that are no longer in the source, then drop empty dirs.
	for (const rel of listFilesRel(targetDir)) {
		if (!sourceSet.has(rel)) rmSync(join(targetDir, rel), { force: true });
	}
	pruneEmptyDirs(targetDir);
}
