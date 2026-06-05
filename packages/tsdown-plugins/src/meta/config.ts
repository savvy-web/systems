/** A single TSDoc tag definition (parity with api-extractor's TSDoc config). */
export interface TsdocTagDefinition {
	readonly tagName: string;
	readonly syntaxKind: "block" | "inline" | "modifier";
	readonly allowMultiple?: boolean | undefined;
}

/** An api-extractor message-suppression rule. messageId is exact-matched; pattern (regex or substring) is AND-matched against the text. */
export interface WarningSuppressionRule {
	readonly messageId: string;
	readonly pattern?: string | undefined;
}

/** TSDoc / doc-warning configuration. suppressWarnings is doc functionality, so it lives here. */
export interface TsdocOptions {
	readonly suppressWarnings?: ReadonlyArray<WarningSuppressionRule> | undefined;
	readonly tagDefinitions?: ReadonlyArray<TsdocTagDefinition> | undefined;
}

/** The `meta` field on defineBuild. Absent means no api-model generation. */
export interface MetaOptions {
	/** Directories to copy the api-model into on `savvy build --target meta`. */
	readonly localPaths?: ReadonlyArray<string> | undefined;
	readonly tsdoc?: TsdocOptions | undefined;
}

/** Fully-resolved meta options (no optionals). */
export interface NormalizedMeta {
	readonly localPaths: ReadonlyArray<string>;
	readonly tsdoc: {
		readonly suppressWarnings: ReadonlyArray<WarningSuppressionRule>;
		readonly tagDefinitions: ReadonlyArray<TsdocTagDefinition>;
	};
}

/** Fill defaults so downstream code never branches on undefined. */
export function normalizeMetaOptions(meta: MetaOptions): NormalizedMeta {
	return {
		localPaths: meta.localPaths ?? [],
		tsdoc: {
			suppressWarnings: meta.tsdoc?.suppressWarnings ?? [],
			tagDefinitions: meta.tsdoc?.tagDefinitions ?? [],
		},
	};
}
