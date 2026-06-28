import { copyFileSync, cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { findRelativeSpecifiers } from "../dts/relative-imports.js";
import type { AmbientDtsEntry } from "../entry/ambient-dts.js";
import { ConfigValidationError } from "../errors.js";

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
 * @public
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

/**
 * Flatten `sourceDir` into `outDir`, additively.
 *
 * `sourceDir/<rel>` copies to `outDir/<rel>` — the `public/` directory segment is dropped, so a
 * package's staged assets land at the package root (`public/ecma.json` -> `<pkg>/ecma.json`). Unlike
 * {@link syncPublicDir} this NEVER deletes: `outDir` is the shared package root that the JS/dts passes
 * own, so deleting "files not in source" would wipe the build product. Stale-asset pruning on a
 * non-clean rebuild is therefore out of scope (a full build's `clean: true` handles it).
 *
 * Collision guard: when a destination already exists, identical bytes mean a prior copy of the same
 * asset (skipped); differing bytes mean a built output occupies that path — throws
 * {@link ConfigValidationError} rather than clobbering it.
 * @public
 */
export function copyPublicDir(sourceDir: string, outDir: string): void {
	if (!existsSync(sourceDir)) return;
	for (const rel of listFilesRel(sourceDir)) {
		const src = join(sourceDir, rel);
		const dst = join(outDir, rel);
		if (existsSync(dst)) {
			if (sameBytes(src, dst)) continue;
			throw new ConfigValidationError({
				path: `public/${rel}`,
				reason: `public asset "${rel}" collides with a built output at the package root — rename or remove it`,
			});
		}
		mkdirSync(dirname(dst), { recursive: true });
		copyFileSync(src, dst);
	}
}

/** @public */
export interface CopyAmbientDtsOptions {
	/** The ambient exports to copy (from `extractAmbientDts`). */
	readonly ambient: ReadonlyArray<AmbientDtsEntry>;
	/** Package root the `source` paths are relative to. */
	readonly srcCwd: string;
	/** The built package dir to copy into (e.g. `dist/dev/pkg`). */
	readonly outDir: string;
}

/**
 * Copy each ambient `.d.ts` export's source verbatim into `outDir/<outName>`, byte-stable (an
 * unchanged file keeps its timestamp). The copy is NOT compiled or bundled, so the build owns two
 * fast-fail checks: the source must exist, and it must be self-contained — a relative
 * import/export/reference would not resolve once the file is flattened to the package root.
 *
 * Throws {@link ConfigValidationError} on a missing source or any relative specifier.
 * @public
 */
export function copyAmbientDts(options: CopyAmbientDtsOptions): void {
	for (const a of options.ambient) {
		const src = join(options.srcCwd, a.source);
		if (!existsSync(src)) {
			throw new ConfigValidationError({
				path: `exports."${a.exportKey}"`,
				reason: `ambient .d.ts source not found: ${a.source}`,
			});
		}
		const relativeSpecifiers = findRelativeSpecifiers(readFileSync(src, "utf-8"), a.source);
		if (relativeSpecifiers.length > 0) {
			throw new ConfigValidationError({
				path: `exports."${a.exportKey}"`,
				reason: `ambient .d.ts "${a.source}" has relative import(s) [${relativeSpecifiers.join(", ")}] that cannot resolve after a verbatim copy — use bare package specifiers or self-contained declare module/global blocks`,
			});
		}
		const dst = join(options.outDir, a.outName);
		if (!existsSync(dst) || !sameBytes(src, dst)) {
			mkdirSync(dirname(dst), { recursive: true });
			copyFileSync(src, dst);
		}
	}
}
