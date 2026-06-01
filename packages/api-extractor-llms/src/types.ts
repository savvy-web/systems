/**
 * Public types for the markdown output system. The two consumer-specific pieces
 * — frontmatter and crosslink routes — are injected via FrontmatterRenderer and
 * RouteFormatter; the body rendering is shared.
 *
 * @packageDocumentation
 */

/** URL-stable slug for an item kind, used in routes and generated doc paths. */
export type ItemKindSlug = "class" | "interface" | "function" | "type" | "variable" | "enum" | "namespace";

/** A reference to a renderable top-level API item. */
export interface ApiItemRef {
	readonly name: string;
	readonly kind: ItemKindSlug;
	/** Lowercased name for the file/url, e.g. "managedsection". */
	readonly slug: string;
}

/** Metadata handed to the injected frontmatter renderer for one doc. */
export interface DocMeta extends ApiItemRef {
	readonly summary: string;
	readonly packageName: string;
}

/** Injected: turn an item reference into a crosslink URL (the only scheme difference). */
export type RouteFormatter = (ref: ApiItemRef) => string;

/** Injected: produce the frontmatter block (incl. trailing blank line) for a doc, or "". */
export type FrontmatterRenderer = (meta: DocMeta) => string;

/** One rendered API doc = its metadata plus the assembled markdown (frontmatter + body). */
export interface RenderedDoc extends DocMeta {
	readonly markdown: string;
}

export interface RenderPackageOptions {
	/** Package display name (used in fallbacks + handed to the frontmatter renderer). */
	readonly packageName: string;
	/** Injected crosslink scheme. Omit → no cross-linking. */
	readonly routeFor?: RouteFormatter;
	/** Injected frontmatter. Omit → bodies only. */
	readonly frontmatter?: FrontmatterRenderer;
}
