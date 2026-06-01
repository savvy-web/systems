/**
 * In-memory document index backing the `silk_docs_search` tool. Loads the
 * manifest + bodies and builds a Fuse index. Search takes a plain query
 * (no operator DSL), broadens multi-word queries with OR, never returns empty,
 * and breaks ties by curated `priority`.
 *
 * @packageDocumentation
 */

import type { FuseResultMatch } from "fuse.js";
import Fuse from "fuse.js";

import type { Manifest, ManifestEntry } from "./schema.js";

export interface SearchResult {
	readonly uri: string;
	readonly title: string;
	readonly summary: string;
	readonly tags: ReadonlyArray<string>;
	readonly tier: ManifestEntry["tier"];
	readonly confidence: number; // 0..1, higher is better
	readonly confidenceLabel: "high" | "medium" | "low";
	readonly matchedOn: ReadonlyArray<string>;
	readonly related: ReadonlyArray<string>;
}

export interface SearchOptions {
	readonly limit?: number;
	readonly tier?: ManifestEntry["tier"];
}

const STOP_WORDS = new Set(["how", "do", "i", "the", "a", "an", "to", "of", "in", "for", "is", "what", "when", "use"]);

const FUSE_THRESHOLD = 0.6;

type Indexed = ManifestEntry & { readonly body: string };

interface RankedResult {
	item: Indexed;
	confidence: number;
	matchedOn: ReadonlyArray<string>;
}

const confidenceLabel = (confidence: number): SearchResult["confidenceLabel"] =>
	confidence >= 0.6 ? "high" : confidence >= 0.4 ? "medium" : "low";

const toRanked = (item: Indexed, score: number | undefined, matches: ReadonlyArray<FuseResultMatch>): RankedResult => ({
	item,
	confidence: 1 - (score ?? 1),
	matchedOn: matches.map((m) => m.key ?? ""),
});

export class DocIndex {
	private constructor(
		private readonly fuse: Fuse<Indexed>,
		private readonly entries: ReadonlyArray<Indexed>,
		private readonly byUri: ReadonlyMap<string, Indexed>,
	) {}

	static fromManifest(manifest: Manifest, bodies: Readonly<Record<string, string>>): DocIndex {
		// Deprecated docs are hidden from the catalog and the resource list, so keep
		// them out of search too — an agent should not be steered to a retired doc.
		const entries: Indexed[] = manifest.entries
			.filter((e) => e.status !== "deprecated")
			.map((e) => ({ ...e, body: bodies[e.uri] ?? "" }));
		const fuse = new Fuse(entries, {
			useExtendedSearch: true,
			ignoreLocation: true,
			includeScore: true,
			includeMatches: true,
			minMatchCharLength: 2,
			threshold: FUSE_THRESHOLD,
			keys: [
				{ name: "title", weight: 0.55 },
				{ name: "tags", weight: 0.3 },
				{ name: "summary", weight: 0.12 },
				{ name: "body", weight: 0.03 },
			],
		});
		const byUri = new Map(entries.map((e) => [e.uri, e]));
		return new DocIndex(fuse, entries, byUri);
	}

	search(query: string, opts: SearchOptions = {}): SearchResult[] {
		const limit = opts.limit ?? 10;
		const tokens = query
			.toLowerCase()
			.split(/\s+/)
			.filter((t) => t.length >= 2 && !STOP_WORDS.has(t));

		// No meaningful tokens (all stop-words or too short) → skip fuse, use fallback.
		// Fuse partial matches on stop-words produce arbitrary results unrelated to
		// relevance; falling back to priority ordering gives consistent, useful output.
		const raw = tokens.length > 0 ? this.fuse.search(tokens.map((t) => `'${t}`).join(" | ")) : [];
		const filteredByTier = opts.tier ? raw.filter((r) => r.item.tier === opts.tier) : raw;

		const ranked: RankedResult[] =
			filteredByTier.length > 0
				? filteredByTier.map((r) => toRanked(r.item, r.score, r.matches ?? []))
				: this.fallback(opts.tier);

		ranked.sort((a, b) => b.confidence - a.confidence || (b.item.priority ?? 0.5) - (a.item.priority ?? 0.5));

		// See-also: pull in related neighbors of the strongest hits that aren't
		// already ranked, as low-confidence entries. The related graph is
		// compile-time validated, so every id resolves.
		const present = new Set(ranked.map((r) => r.item.uri));
		const seeAlso: RankedResult[] = [];
		for (const r of ranked.slice(0, 3)) {
			for (const rel of r.item.related) {
				const uri = rel.startsWith("silk://") ? rel : `silk://${rel}`;
				if (present.has(uri)) continue;
				const neighbor = this.byUri.get(uri);
				if (!neighbor) continue;
				present.add(uri);
				seeAlso.push({ item: neighbor, confidence: 0, matchedOn: ["related"] });
			}
		}

		return [...ranked, ...seeAlso].slice(0, limit).map(({ item, confidence, matchedOn }) => ({
			uri: item.uri,
			title: item.title,
			summary: item.summary,
			tags: item.tags,
			tier: item.tier,
			confidence: Number(confidence.toFixed(3)),
			confidenceLabel: confidenceLabel(confidence),
			matchedOn: [...new Set(matchedOn)].filter(Boolean),
			related: item.related,
		}));
	}

	/** Never return empty: surface the top entries (by priority) as low-confidence. */
	private fallback(tier?: SearchOptions["tier"]): RankedResult[] {
		return this.entries
			.filter((e) => (tier ? e.tier === tier : true))
			.slice()
			.sort((a, b) => (b.priority ?? 0.5) - (a.priority ?? 0.5))
			.slice(0, 5)
			.map((item) => ({ item, confidence: 0, matchedOn: [] as ReadonlyArray<string> }));
	}
}
