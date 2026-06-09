// packages/tsdown-plugins/src/build/strip-maps.ts
import type { Dirent } from "node:fs";
import { readdirSync, rmSync } from "node:fs";
import { join } from "node:path";

/**
 * Remove declaration source-map files (`.d.ts.map` / `.d.cts.map`) from a built `pkg`
 * directory, returning the removed paths.
 *
 * The dts pass emits these next to each `.d.ts` (the resolved dts tsconfig sets
 * `declarationMap: true`) because API Extractor reads them during meta generation to
 * resolve original-source positions. But they are dead weight in a PUBLISHED package —
 * they reference `.ts` sources the tarball does not ship — and they leak local source
 * paths, so the prod build strips them AFTER meta generation has consumed them. The dev
 * build keeps them (it is never published, and `savvy build --target meta` reads them).
 *
 * Recurses, but skips `node_modules` so it does not traverse a self-contained bundle's
 * vendored tree — only the package's own emitted declarations carry maps worth stripping.
 */
export function removeDeclarationMaps(pkgDir: string): string[] {
	const removed: string[] = [];
	let entries: Dirent[];
	try {
		entries = readdirSync(pkgDir, { withFileTypes: true });
	} catch {
		return removed; // dir absent — nothing to strip
	}
	for (const entry of entries) {
		if (entry.name === "node_modules") continue;
		const full = join(pkgDir, entry.name);
		if (entry.isDirectory()) {
			removed.push(...removeDeclarationMaps(full));
		} else if (entry.name.endsWith(".d.ts.map") || entry.name.endsWith(".d.cts.map")) {
			rmSync(full, { force: true });
			removed.push(full);
		}
	}
	return removed;
}
