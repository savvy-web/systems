/**
 * Pure corpus compiler: validates a set of raw docs against the corpus
 * integrity rules and produces the manifest + body map. No disk I/O.
 *
 * @packageDocumentation
 */

import { Schema } from "effect";
import type { Manifest, ManifestEntry } from "../src/resources/schema.js";
import { DocFrontMatter } from "../src/resources/schema.js";
import type { TagRegistry } from "../src/resources/tags.js";
import { canonicalizeTags } from "../src/resources/tags.js";

export interface RawDoc {
	readonly relPath: string; // e.g. "standards/changeset-discipline.md"
	readonly frontMatter: unknown; // decoded against DocFrontMatter
	readonly body: string;
	readonly lastModified: string;
}

export interface CompileOptions {
	readonly bodyBudgetBytes?: Partial<Record<"standards" | "packages" | "guides", number>>;
}

export interface CompileResult {
	readonly manifest: Manifest;
	readonly bodies: Record<string, string>; // uri -> markdown body
	readonly errors: ReadonlyArray<string>;
	readonly warnings: ReadonlyArray<string>;
}

const DEAD_NAMES = [
	"workflow-control-action",
	"workflow-runtime-action",
	"workflow-release-action",
	"workflow-integration",
];

const PROVENANCE = "<!-- Generated from the API Extractor model; do not hand-edit. -->\n\n";

const decode = Schema.decodeUnknownEither(DocFrontMatter);

export function compileCorpus(docs: ReadonlyArray<RawDoc>, registry: TagRegistry, opts: CompileOptions): CompileResult {
	const errors: string[] = [];
	const warnings: string[] = [];
	const entries: ManifestEntry[] = [];
	const bodies: Record<string, string> = {};
	const seenIds = new Set<string>();

	for (const doc of docs) {
		const decoded = decode(doc.frontMatter);
		if (decoded._tag === "Left") {
			errors.push(`${doc.relPath}: invalid front-matter: ${decoded.left.message}`);
			continue;
		}
		const fm = decoded.right;

		if (seenIds.has(fm.id)) {
			errors.push(`${doc.relPath}: duplicate id ${fm.id}`);
			continue;
		}
		seenIds.add(fm.id);

		const dirTier = doc.relPath.split("/")[0];
		if (dirTier !== fm.tier) errors.push(`${doc.relPath}: tier ${fm.tier} does not match directory ${dirTier}`);
		if (!fm.id.startsWith(`${fm.tier}/`)) errors.push(`${doc.relPath}: id ${fm.id} must start with ${fm.tier}/`);

		let tags: string[];
		try {
			tags = canonicalizeTags(fm.tags, registry);
		} catch (err) {
			errors.push(`${doc.relPath}: ${(err as Error).message}`);
			continue;
		}

		for (const dead of DEAD_NAMES) {
			if (doc.body.includes(dead)) errors.push(`${doc.relPath}: dead identifier: ${dead} (use the silk-* name)`);
		}

		const budget = opts.bodyBudgetBytes?.[fm.tier];
		const bytes = Buffer.byteLength(doc.body, "utf8");
		if (fm.source !== "generated" && budget !== undefined && bytes > budget) {
			warnings.push(`${doc.relPath}: body ${bytes} bytes exceeds budget ${budget} — split into focused pages`);
		}

		const uri = `silk://${fm.id}`;
		entries.push({ ...fm, tags, uri, lastModified: doc.lastModified });
		bodies[uri] = fm.source === "generated" ? PROVENANCE + doc.body : doc.body;
	}

	// Reference integrity: every related target must resolve to a known id.
	for (const entry of entries) {
		for (const rel of entry.related) {
			const relId = rel.replace(/^silk:\/\//, "");
			if (!seenIds.has(relId)) errors.push(`${entry.id}: dangling related: ${relId}`);
		}
	}

	return {
		manifest: { generatedAt: "", entries },
		bodies,
		errors,
		warnings,
	};
}
