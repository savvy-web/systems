/**
 * Changesets API changelog formatter shim for \@savvy-web/silk.
 *
 * Drop-in replacement for \@savvy-web/changesets/changelog (superseded by
 * \@savvy-web/changelog, which this mirrors exactly). The default export is
 * the ChangelogFunctions object consumed by the Changesets CLI via the
 * changelog field in .changeset/config.json.
 *
 * This shim is the host adapter for the changesets CLI, a foreign process
 * that supplies no context of its own, so the warning mode is read from
 * `process.env` HERE and handed to the engine, which never reads it.
 *
 * @packageDocumentation
 */

import { Changesets } from "@savvy-web/silk-effects";

const logMode = (): Changesets.ChangesetLogModeValue => {
	if (process.env.VITEST) return "silent";
	if (process.env.GITHUB_ACTIONS === "true") return "github";
	return "stderr";
};

// `@changesets/types` is not a silk dependency; `typeof Changesets.changelogFunctions`
// IS that package's nominal `ChangelogFunctions` (silk-effects annotates it so).
const changelogFunctions: typeof Changesets.changelogFunctions = Changesets.makeChangelogFunctions({
	logMode: logMode(),
});
export default changelogFunctions;
