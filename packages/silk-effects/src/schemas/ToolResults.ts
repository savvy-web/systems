import { Data, Schema } from "effect";

/** Where a tool was resolved from. @since 0.2.0 */
export const ToolSource = Schema.Literal("global", "local");
/** @since 0.2.0 */
export type ToolSource = typeof ToolSource.Type;

/** How to extract a version string from a CLI tool. @since 0.2.0 */
// biome-ignore lint/style/useConsistentTypeDefinitions: Data.TaggedEnum requires type alias
export type VersionExtractorDefinition = {
	readonly Flag: {
		readonly flag: string;
		readonly parse?: ((output: string) => string) | undefined;
	};
	readonly Json: {
		readonly flag: string;
		readonly path: string;
	};
	// biome-ignore lint/complexity/noBannedTypes: Data.TaggedEnum requires {} for empty variants
	readonly None: {};
};
/** @since 0.2.0 */
export type VersionExtractor = Data.TaggedEnum<VersionExtractorDefinition>;
/** @since 0.2.0 */
export const VersionExtractor = Data.taggedEnum<VersionExtractor>();

/** What to do when both global and local versions differ. @since 0.2.0 */
// biome-ignore lint/style/useConsistentTypeDefinitions: Data.TaggedEnum requires type alias
export type ResolutionPolicyDefinition = {
	// biome-ignore lint/complexity/noBannedTypes: Data.TaggedEnum requires {} for empty variants
	readonly Report: {};
	// biome-ignore lint/complexity/noBannedTypes: Data.TaggedEnum requires {} for empty variants
	readonly PreferLocal: {};
	// biome-ignore lint/complexity/noBannedTypes: Data.TaggedEnum requires {} for empty variants
	readonly PreferGlobal: {};
	// biome-ignore lint/complexity/noBannedTypes: Data.TaggedEnum requires {} for empty variants
	readonly RequireMatch: {};
};
/** @since 0.2.0 */
export type ResolutionPolicy = Data.TaggedEnum<ResolutionPolicyDefinition>;
/** @since 0.2.0 */
export const ResolutionPolicy = Data.taggedEnum<ResolutionPolicy>();

/** Where the tool must be found. @since 0.2.0 */
// biome-ignore lint/style/useConsistentTypeDefinitions: Data.TaggedEnum requires type alias
export type SourceRequirementDefinition = {
	// biome-ignore lint/complexity/noBannedTypes: Data.TaggedEnum requires {} for empty variants
	readonly Any: {};
	// biome-ignore lint/complexity/noBannedTypes: Data.TaggedEnum requires {} for empty variants
	readonly OnlyLocal: {};
	// biome-ignore lint/complexity/noBannedTypes: Data.TaggedEnum requires {} for empty variants
	readonly OnlyGlobal: {};
	// biome-ignore lint/complexity/noBannedTypes: Data.TaggedEnum requires {} for empty variants
	readonly Both: {};
};
/** @since 0.2.0 */
export type SourceRequirement = Data.TaggedEnum<SourceRequirementDefinition>;
/** @since 0.2.0 */
export const SourceRequirement = Data.taggedEnum<SourceRequirement>();
