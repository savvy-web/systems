/**
 * The silk changelog generator as a standalone installable package — the
 * canonical `changelog` id for `.changeset/config.json`. Thin re-export of
 * `@savvy-web/silk-effects`' changelog functions; silk-effects remains the
 * single source of truth.
 *
 * @packageDocumentation
 */

import type { ChangelogFunctions } from "@changesets/types";
import { Changesets } from "@savvy-web/silk-effects";

// Annotate with the nominal ChangelogFunctions type instead of typeof-chaining
// through the Effect-typed Changesets namespace: the typeof chain forces the
// dts bundler to materialize the entire silk-effects + effect type graph into
// the published declarations (~644KB) for a two-function surface.
const changelogFunctions: ChangelogFunctions = Changesets.changelogFunctions;
export default changelogFunctions;
