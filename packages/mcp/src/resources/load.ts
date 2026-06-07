/**
 * Resolve the content root across source/built layouts and load the manifest
 * + a doc body by relative path.
 *
 * @packageDocumentation
 */

import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { Schema } from "effect";

import { resolveResourcePath } from "./paths.js";
import type { Manifest as ManifestType } from "./schema.js";
import { Manifest } from "./schema.js";

/**
 * Locate the directory holding `manifest.json` + the content markdown. The
 * built bundle copies `public/` next to the emitted chunk (`<pkg>/public/content`);
 * the source layout keeps it under the package root (`packages/mcp/public/content`).
 * Probe both and fail loudly if neither has a manifest, so a broken build surfaces a
 * clear path list instead of an opaque ENOENT later in {@link loadManifest}.
 */
export function resolveContentRoot(): string {
	const here = dirname(fileURLToPath(import.meta.url));
	const candidates = [
		join(here, "..", "public", "content"), // built: load.js at dist/<env>/pkg/resources/ -> pkg/public/content
		join(here, "..", "..", "public", "content"), // source: src/resources/ via tsx -> packages/mcp/public/content
	];
	for (const candidate of candidates) {
		if (existsSync(join(candidate, "manifest.json"))) return candidate;
	}
	throw new Error(`[savvy-mcp] cannot locate public/content with a manifest.json (tried: ${candidates.join(", ")})`);
}

export function loadManifest(contentRoot: string): ManifestType {
	const raw = JSON.parse(readFileSync(join(contentRoot, "manifest.json"), "utf8")) as unknown;
	return Schema.decodeUnknownSync(Manifest)(raw);
}

/** Read a doc body markdown by its relative path (the `{+path}` template var). */
export function readDocBody(contentRoot: string, relPath: string): string {
	return readFileSync(resolveResourcePath(contentRoot, relPath), "utf8");
}
