import { defineBuild, runBuild } from "@savvy-web/bundler";

const config = defineBuild({
	// No `externals`: effect and @effect/platform are declared deps, auto-externalized by tsdown.
	devManifest: "preserve",
	meta: {
		localPaths: ["../mcp/lib/models/silk-effects", "../../website/lib/models/silk-effects"],
		tsdoc: {
			suppressWarnings: [{ messageId: "ae-forgotten-export", pattern: "_base" }],
			tagDefinitions: [{ tagName: "@since", syntaxKind: "block" }],
		},
	},
});

export default config;

if (import.meta.main) {
	await runBuild(config, { cwd: import.meta.dirname, argv: process.argv.slice(2) });
}
