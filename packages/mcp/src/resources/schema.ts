/**
 * Front-matter and manifest schemas for the Silk resource corpus.
 *
 * @packageDocumentation
 */

import { Schema } from "effect";

/** `id` = the stable URI suffix: tier-prefixed, slash-separated slug segments. */
const ID_PATTERN = /^(standards|packages|guides)\/[A-Za-z0-9._-]+(?:\/[A-Za-z0-9._-]+)*\/?$/;

export const Tier = Schema.Literal("standards", "packages", "guides");
export const Audience = Schema.Array(Schema.Literal("user", "assistant"));
export const Source = Schema.Literal("hand", "generated");
export const Status = Schema.Literal("draft", "stable", "deprecated");

/** YAML front-matter on every content markdown file. */
export const DocFrontMatter = Schema.Struct({
	id: Schema.String.pipe(Schema.pattern(ID_PATTERN)),
	title: Schema.NonEmptyString,
	summary: Schema.NonEmptyString,
	tier: Tier,
	source: Source,
	status: Schema.optionalWith(Status, { default: () => "stable" as const }),
	supersededBy: Schema.optional(Schema.String),
	tags: Schema.Array(Schema.NonEmptyString),
	audience: Schema.optionalWith(Audience, { default: () => ["assistant"] as ReadonlyArray<"assistant"> }),
	priority: Schema.optionalWith(Schema.Number.pipe(Schema.between(0, 1)), { default: () => 0.5 }),
	related: Schema.optionalWith(Schema.Array(Schema.String), { default: () => [] as ReadonlyArray<string> }),
});
export type DocFrontMatter = Schema.Schema.Type<typeof DocFrontMatter>;

/** A manifest entry = decoded front-matter + the derived uri + lastModified. */
export const ManifestEntry = Schema.Struct({
	...DocFrontMatter.fields,
	uri: Schema.String,
	lastModified: Schema.optional(Schema.String),
});
export type ManifestEntry = Schema.Schema.Type<typeof ManifestEntry>;

export const Manifest = Schema.Struct({
	generatedAt: Schema.String,
	entries: Schema.Array(ManifestEntry),
});
export type Manifest = Schema.Schema.Type<typeof Manifest>;

export const decodeDocFrontMatter = Schema.decodeUnknown(DocFrontMatter);
export const decodeManifest = Schema.decodeUnknown(Manifest);
