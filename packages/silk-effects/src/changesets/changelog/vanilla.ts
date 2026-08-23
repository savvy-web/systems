/**
 * The vanilla changesets changelog renderer — `\@changesets/changelog-git`,
 * re-exported.
 *
 * @remarks
 * Some consumers (notably `silk-release-action`) need the STOCK changesets
 * rendering — plain summary lines with commit hashes, no sections, no
 * attribution, no dependency tables — as a fallback or comparison path
 * alongside the silk formatter. Re-exporting the upstream implementation
 * here means those consumers depend only on this package: they get exact
 * parity with `\@changesets/changelog-git` (this is a re-export, never a
 * reimplementation) without declaring the dependency themselves.
 *
 * @see {@link changelogFunctions} in `./index.ts` for the silk formatter
 *   this is the vanilla alternative to
 */

import changelogGit from "@changesets/changelog-git";

import type { ChangelogFunctions } from "../vendor/types.js";

/**
 * The stock `\@changesets/changelog-git` changelog implementation.
 *
 * @remarks
 * This is the exact upstream default export (identity-equal, pinned by
 * test), typed against this package's re-exported {@link ChangelogFunctions}
 * interface. Use it wherever the plain changesets rendering is wanted
 * instead of the silk section-aware formatter — e.g. in
 * `.changeset/config.json` via a changelog module that forwards it, or
 * programmatically from a release pipeline.
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
export const vanillaChangelogFunctions: ChangelogFunctions = changelogGit;
