/**
 * @savvy-web/api-extractor-llms — render Microsoft API Extractor models into
 * LLM-lean markdown, with injectable frontmatter and crosslink routes.
 *
 * @packageDocumentation
 */

export { CrossLinker } from "./cross-linker.js";
export { TypeSignatureFormatter } from "./formatter.js";
export { loadApiModel } from "./model-loader.js";
export { type RenderItemOptions, renderItem, renderPackage } from "./render.js";
export {
	extractPlainText,
	getDeprecation,
	getExamples,
	getParams,
	getReleaseTag,
	getReturns,
	getSummary,
	hasModifierTag,
} from "./tsdoc.js";
export type {
	ApiItemRef,
	DocMeta,
	FrontmatterRenderer,
	ItemKindSlug,
	RenderPackageOptions,
	RenderedDoc,
	RouteFormatter,
} from "./types.js";
