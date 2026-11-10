/**
 * The silk changelog generator as a standalone installable package — the
 * canonical `changelog` id for `.changeset/config.json`. Thin wrapper over
 * `@savvy-web/silk-effects`' changelog functions; silk-effects remains the
 * single source of truth.
 *
 * This package is the host adapter for the changesets CLI, a foreign process
 * that supplies no context of its own, so the warning mode and the GitHub
 * client (token and server) are read from `process.env` HERE and handed to
 * the engine, which never reads it.
 *
 * @packageDocumentation
 */

import type { ChangelogFunctions } from "@effected/changesets";
import { ChangelogInfo, GitHubClient } from "@effected/github";
import { Changesets } from "@savvy-web/silk-effects";
import { Layer, Redacted } from "effect";

const logMode = (): Changesets.ChangesetLogModeValue => {
	if (process.env.VITEST) return "silent";
	if (process.env.GITHUB_ACTIONS === "true") return "github";
	return "stderr";
};

/**
 * The GitHub API root for a GitHub Enterprise Server, or `undefined` for
 * github.com. `GITHUB_API_URL` is what Actions sets; `GITHUB_GRAPHQL_URL`
 * (`https://<host>/api/graphql`) is the variable `@changesets/get-github-info`
 * documented, so it is honoured too, mapped to its REST root.
 */
const baseUrl = (): string | undefined => {
	const api = process.env.GITHUB_API_URL;
	if (api) return api;
	const graphql = process.env.GITHUB_GRAPHQL_URL;
	if (graphql && graphql !== "https://api.github.com/graphql") return graphql.replace(/\/graphql\/?$/, "/v3");
	return undefined;
};

/**
 * Commit metadata from GitHub when a token is set (`GITHUB_TOKEN`, as
 * `@changesets/get-github-info` reads it); without one, lines render with no
 * attribution, after the engine's one warning per lookup.
 */
const changelogInfo = (): Layer.Layer<ChangelogInfo> | undefined => {
	const token = process.env.GITHUB_TOKEN;
	if (!token) return undefined;
	const url = baseUrl();
	return ChangelogInfo.layer.pipe(
		Layer.provide(
			GitHubClient.layerFromToken({
				token: Redacted.make(token),
				userAgent: "@savvy-web/changelog",
				...(url === undefined ? {} : { baseUrl: url }),
			}),
		),
	);
};

// Annotate with the nominal ChangelogFunctions type instead of typeof-chaining
// through the Effect-typed Changesets namespace: the typeof chain forces the
// dts bundler to materialize the entire silk-effects + effect type graph into
// the published declarations (~644KB) for a two-function surface.
const changelogFunctions: ChangelogFunctions = Changesets.makeChangelogFunctions({
	logMode: logMode(),
	changelogInfo: changelogInfo(),
});
export default changelogFunctions;
