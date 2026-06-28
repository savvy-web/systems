import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync } from "node:fs";
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

/**
 * Flatten `sourceDir` into `outDir`, additively.
 *
 * `sourceDir/<rel>` copies to `outDir/<rel>` — the `public/` directory segment is dropped, so a
 * package's staged assets land at the package root (`public/ecma.json` becomes `<pkg>/ecma.json`). This
 * function NEVER deletes: `outDir` is the shared package root that the JS/dts passes
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
