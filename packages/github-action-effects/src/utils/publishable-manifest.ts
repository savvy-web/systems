/** The dependency blocks npm resolves when installing a published package. */
const DEPENDENCY_BLOCKS = ["dependencies", "devDependencies", "peerDependencies", "optionalDependencies"] as const;

/**
 * Protocol prefixes that only a workspace-aware package manager can resolve.
 * A published manifest carrying one is uninstallable: npm rejects it with
 * `EUNSUPPORTEDPROTOCOL: Unsupported URL Type "catalog:"`.
 */
const UNRESOLVED_PROTOCOLS = ["catalog:", "workspace:"] as const;

/**
 * A dependency whose specifier never made it through version resolution.
 *
 * @internal
 */
export interface UnresolvedSpecifier {
	/** The manifest block the dependency was declared in. */
	readonly block: string;
	/** The dependency's package name. */
	readonly name: string;
	/** The offending specifier, verbatim. */
	readonly specifier: string;
}

/**
 * Find dependency specifiers that a registry consumer could never install.
 *
 * @remarks
 * `catalog:` and `workspace:` are pnpm-only protocols that the packing step is
 * meant to rewrite into concrete ranges. A manifest that still carries one is
 * by definition an unresolved dev/workspace manifest that was packed by
 * mistake — the failure shape behind `yaml-effect@0.7.1`, which published and
 * then failed to install anywhere.
 *
 * The check reads specifiers only, so a package legitimately *named*
 * `my-catalog` is never flagged.
 *
 * @param manifest - Parsed `package.json` contents. Non-objects yield no findings.
 * @returns Every offending specifier, in block order.
 *
 * @internal
 */
export const findUnresolvedSpecifiers = (manifest: unknown): ReadonlyArray<UnresolvedSpecifier> => {
	if (typeof manifest !== "object" || manifest === null) return [];
	const record = manifest as Record<string, unknown>;

	const found: Array<UnresolvedSpecifier> = [];
	for (const block of DEPENDENCY_BLOCKS) {
		const deps = record[block];
		if (typeof deps !== "object" || deps === null) continue;
		for (const [name, specifier] of Object.entries(deps as Record<string, unknown>)) {
			if (typeof specifier !== "string") continue;
			if (UNRESOLVED_PROTOCOLS.some((protocol) => specifier.startsWith(protocol))) {
				found.push({ block, name, specifier });
			}
		}
	}
	return found;
};
