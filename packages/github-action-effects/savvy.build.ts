import { defineBuild, runBuild } from "@savvy-web/bundler";

const config = defineBuild({
	// Only UNDECLARED transitive packages need listing here: effect, @effect/platform,
	// @effect/platform-node, and @octokit/auth-app are declared deps (auto-externalized).
	// @effect/cluster/@effect/rpc/@effect/sql are referenced transitively but not declared,
	// so tsdown would bundle them without this explicit externalization.
	externals: ["@effect/cluster", "@effect/rpc", "@effect/sql"],
	devManifest: "preserve",
	meta: {
		localPaths: ["../mcp/lib/models/github-action-effects", "../../website/lib/models/github-action-effects"],
		tsdoc: { suppressWarnings: [{ messageId: "ae-forgotten-export", pattern: "_base" }] },
	},
});

export default config;

if (import.meta.main) {
	await runBuild(config, { cwd: import.meta.dirname, argv: process.argv.slice(2) });
}
