/**
 * Build-time compile step: read content markdown, run corpus integrity checks,
 * and write content/manifest.json. Fails the build on any error.
 *
 * @internal
 */
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { isDeepStrictEqual } from "node:util";

import matter from "gray-matter";

import { loadTagRegistry } from "../../src/resources/tags.js";
import type { RawDoc } from "./compile.js";
import { compileCorpus } from "./compile.js";

const here = dirname(fileURLToPath(import.meta.url));
const contentRoot = join(here, "..", "..", "public", "content");

function walk(dir: string): string[] {
	return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
		if (e.name.startsWith("_")) return [];
		const full = join(dir, e.name);
		if (e.isDirectory()) return walk(full);
		return e.isFile() && e.name.endsWith(".md") ? [full] : [];
	});
}

const files = walk(contentRoot);
const docs: RawDoc[] = files.map((file) => {
	const parsed = matter(readFileSync(file, "utf8"));
	return {
		relPath: relative(contentRoot, file).split("\\").join("/"),
		frontMatter: parsed.data,
		body: parsed.content.trim(),
		// No lastModified: a git-derived timestamp can never be stable in the commit
		// that introduces a doc (the commit time is unknown at build time), so the
		// committed manifest would churn on every build. Git history is the record.
	};
});

const result = compileCorpus(docs, loadTagRegistry(), {
	bodyBudgetBytes: { standards: 6000, packages: 8000, guides: 10000 },
});

for (const w of result.warnings) process.stderr.write(`[build-catalog] WARN ${w}\n`);
if (result.errors.length > 0) {
	for (const e of result.errors) process.stderr.write(`[build-catalog] ERROR ${e}\n`);
	process.exit(1);
}

const { manifest } = result;
const manifestPath = join(contentRoot, "manifest.json");
const next = `${JSON.stringify(manifest, null, "\t")}\n`;

// Only rewrite when the compiled manifest differs in value from what's on disk.
// Deep-equality on the parsed JSON (not the serialized bytes) means a formatter
// reindenting manifest.json won't trigger a rewrite, so the build doesn't fight
// lint/format or churn git on no-op runs.
let current: unknown;
try {
	current = JSON.parse(readFileSync(manifestPath, "utf8"));
} catch {
	current = undefined;
}
if (isDeepStrictEqual(current, JSON.parse(next))) {
	process.stderr.write(`[build-catalog] manifest unchanged (${manifest.entries.length} entries)\n`);
} else {
	writeFileSync(manifestPath, next);
	process.stderr.write(`[build-catalog] wrote manifest with ${manifest.entries.length} entries\n`);
}
