/**
 * The silk changelog generator as a standalone installable package — the
 * canonical `changelog` id for `.changeset/config.json`. Thin re-export of
 * `@savvy-web/silk-effects`' changelog functions; silk-effects remains the
 * single source of truth.
 *
 * @packageDocumentation
 */

import { Changesets } from "@savvy-web/silk-effects";

const changelogFunctions: typeof Changesets.changelogFunctions = Changesets.changelogFunctions;
export default changelogFunctions;
