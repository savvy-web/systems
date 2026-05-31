/**
 * Changesets API changelog formatter shim for \@savvy-web/silk.
 *
 * Drop-in replacement for \@savvy-web/changesets/changelog.
 * The default export is the ChangelogFunctions object consumed by the
 * Changesets CLI via the changelog field in .changeset/config.json.
 *
 * @packageDocumentation
 */

import { Changesets } from "@savvy-web/silk-effects";

export default Changesets.changelogFunctions;
