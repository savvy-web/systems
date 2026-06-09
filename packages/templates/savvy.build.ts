import { defineBuild, runBuild } from "@savvy-web/bundler";

const config = defineBuild({
	// No `externals`: effect is a declared dependency, auto-externalized by tsdown.
	devManifest: "preserve",
	meta: {
		localPaths: ["../mcp/lib/models/templates", "../../website/lib/models/templates"],
		tsdoc: { suppressWarnings: [{ messageId: "ae-forgotten-export" }] },
	},
});

export default config;

if (import.meta.main) {
	await runBuild(config, { cwd: import.meta.dirname, argv: process.argv.slice(2) });
}
