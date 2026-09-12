/**
 * The silk changelog generator as a standalone installable package — the
 * canonical `changelog` id for `.changeset/config.json`. Thin wrapper over
 * `@savvy-web/silk-effects`' changelog functions; silk-effects remains the
 * single source of truth.
 *
 * This package is the host adapter for the changesets CLI, a foreign process
 * that supplies no context of its own, so the warning mode is read from
 * `process.env` HERE and handed to the engine, which never reads it.
 *
 * @packageDocumentation
 */

import type { ChangelogFunctions } from "@changesets/types";
import { Changesets } from "@savvy-web/silk-effects";

const logMode = (): Changesets.ChangesetLogModeValue => {
	if (process.env.VITEST) return "silent";
	if (process.env.GITHUB_ACTIONS === "true") return "github";
	return "stderr";
};

// Annotate with the nominal ChangelogFunctions type instead of typeof-chaining
// through the Effect-typed Changesets namespace: the typeof chain forces the
// dts bundler to materialize the entire silk-effects + effect type graph into
// the published declarations (~644KB) for a two-function surface.
const changelogFunctions: ChangelogFunctions = Changesets.makeChangelogFunctions({ logMode: logMode() });
export default changelogFunctions;
