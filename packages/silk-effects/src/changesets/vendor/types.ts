/**
 * The changelog-module contract types, from `\@effected/changesets`.
 *
 * @remarks
 * The kit models `\@changesets/types`' changelog contract structurally — the
 * two are mutually assignable — so a module typed against these still loads
 * under `\@changesets/cli` while nothing here depends on `\@changesets/types`.
 *
 * - {@link ChangelogFunctions} — the object a changelog module exports, with
 *   `getReleaseLine` and `getDependencyReleaseLine`
 * - {@link ModCompWithPackage} — a release paired with its package, passed to
 *   `getDependencyReleaseLine`
 * - {@link NewChangesetWithCommit} — a changeset with the commit that added
 *   it, passed to `getReleaseLine`
 * - {@link VersionType} — the bump a line is rendered under
 *
 * Internal only: `src/index.ts` re-exports nothing from the kit, so these are
 * never a second import path for a kit type.
 *
 * @internal
 */

export type {
	ChangelogFunctions,
	GetDependencyReleaseLine,
	GetReleaseLine,
	ModCompWithPackage,
	NewChangesetWithCommit,
	VersionType,
} from "@effected/changesets";
