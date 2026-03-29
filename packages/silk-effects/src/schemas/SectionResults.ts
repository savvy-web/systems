import { Data } from "effect";

/**
 * Result of comparing two section contents.
 *
 * @since 0.2.0
 */
// biome-ignore lint/style/useConsistentTypeDefinitions: Data.TaggedEnum requires type alias, not interface
export type SectionDiffDefinition = {
	// biome-ignore lint/complexity/noBannedTypes: Data.TaggedEnum requires {} for empty variants
	readonly Unchanged: {};
	readonly Changed: {
		readonly added: ReadonlyArray<string>;
		readonly removed: ReadonlyArray<string>;
	};
};

/** @since 0.2.0 */
export type SectionDiff = Data.TaggedEnum<SectionDiffDefinition>;

/** @since 0.2.0 */
export const SectionDiff = Data.taggedEnum<SectionDiff>();

/**
 * Result of a sync operation.
 *
 * @since 0.2.0
 */
// biome-ignore lint/style/useConsistentTypeDefinitions: Data.TaggedEnum requires type alias, not interface
export type SyncResultDefinition = {
	// biome-ignore lint/complexity/noBannedTypes: Data.TaggedEnum requires {} for empty variants
	readonly Created: {};
	readonly Updated: { readonly diff: SectionDiff };
	// biome-ignore lint/complexity/noBannedTypes: Data.TaggedEnum requires {} for empty variants
	readonly Unchanged: {};
};

/** @since 0.2.0 */
export type SyncResult = Data.TaggedEnum<SyncResultDefinition>;

/** @since 0.2.0 */
export const SyncResult = Data.taggedEnum<SyncResult>();

/**
 * Result of a check operation.
 *
 * @since 0.2.0
 */
// biome-ignore lint/style/useConsistentTypeDefinitions: Data.TaggedEnum requires type alias, not interface
export type CheckResultDefinition = {
	readonly Found: { readonly isUpToDate: boolean; readonly diff: SectionDiff };
	// biome-ignore lint/complexity/noBannedTypes: Data.TaggedEnum requires {} for empty variants
	readonly NotFound: {};
};

/** @since 0.2.0 */
export type CheckResult = Data.TaggedEnum<CheckResultDefinition>;

/** @since 0.2.0 */
export const CheckResult = Data.taggedEnum<CheckResult>();
