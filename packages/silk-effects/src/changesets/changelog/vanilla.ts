/**
 * The vanilla changesets changelog renderer, matching
 * `\@changesets/changelog-git` byte for byte.
 *
 * @remarks
 * Some consumers (notably `silk-release-action`) need the STOCK changesets
 * rendering — plain summary lines with commit hashes, no sections, no
 * attribution, no dependency tables — as a fallback or comparison path
 * alongside the silk formatter. This module is that renderer written over the
 * kit's `ChangelogFunctions` contract, so those consumers depend only on this
 * package. `__test__/changesets/changelog__vanilla.test.ts` holds its output
 * equal to `\@changesets/changelog-git`'s.
 *
 * @see {@link changelogFunctions} in `./index.ts` for the silk formatter
 *   this is the vanilla alternative to
 */

import type { ChangelogFunctions } from "../vendor/types.js";

/**
 * The stock changesets changelog implementation.
 *
 * @remarks
 * Renders what `\@changesets/changelog-git` renders, synchronously as it does:
 * each release line is `- <short sha>: <first summary line>` (no sha prefix
 * when the changeset has no commit) with later summary lines indented two
 * spaces; the dependency line lists one `- Updated dependencies [<short sha>]`
 * per changeset, then `  - <name>@<newVersion>` per updated dependency, and is
 * empty when no dependency was updated. Use it wherever the plain changesets
 * rendering is wanted instead of the silk section-aware formatter.
 *
 * @example
 * ```typescript
 * import { Changesets } from "@savvy-web/silk-effects";
 *
 * const line = await Changesets.vanillaChangelogFunctions.getReleaseLine(
 *   { id: "x", summary: "Fix a thing", releases: [{ name: "pkg", type: "patch" }] },
 *   "patch",
 *   null,
 * );
 * ```
 *
 * @public
 */
export const vanillaChangelogFunctions: ChangelogFunctions = {
	getReleaseLine: (changeset) => {
		const [firstLine, ...futureLines] = changeset.summary.split("\n").map((line) => line.trimEnd());
		let line = `- ${changeset.commit ? `${changeset.commit.slice(0, 7)}: ` : ""}${firstLine}`;
		if (futureLines.length > 0) line += `\n${futureLines.map((l) => `  ${l}`).join("\n")}`;
		return line;
	},
	getDependencyReleaseLine: (changesets, dependenciesUpdated) => {
		if (dependenciesUpdated.length === 0) return "";
		const changesetLinks = changesets.map(
			(changeset) => `- Updated dependencies${changeset.commit ? ` [${changeset.commit.slice(0, 7)}]` : ""}`,
		);
		const updatedDependencies = dependenciesUpdated.map(
			(dependency) => `  - ${dependency.name}@${dependency.newVersion}`,
		);
		return [...changesetLinks, ...updatedDependencies].join("\n");
	},
};
