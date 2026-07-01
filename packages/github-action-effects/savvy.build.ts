import { build } from "@savvy-web/bundler";

await build({
	// Only UNDECLARED transitive packages need listing here: effect, @effect/platform,
	// @effect/platform-node, and @octokit/auth-app are declared deps (auto-externalized).
	// @effect/cluster/@effect/rpc/@effect/sql are referenced transitively but not declared,
	// so tsdown would bundle them without this explicit externalization.
	externals: ["@effect/cluster", "@effect/rpc", "@effect/sql"],
	devManifest: "preserve",
	meta: {
		localPaths: ["../../website/lib/models/github-action-effects"],
		tsdoc: {
			suppressWarnings: [
				{ messageId: "ae-forgotten-export", pattern: "_base" },
				// rolldown's dts-gen synthesizes a `declare namespace <mod>_d_exports` for the
				// `export * as Step` re-export and drops the release-tag comment, so api-extractor
				// cannot see the @public we put on the source statement. Known bundler limitation.
				{ messageId: "ae-missing-release-tag", pattern: "_d_exports" },
			],
		},
	},
});
