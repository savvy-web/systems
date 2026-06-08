import { defineBuild, runBuild } from "@savvy-web/bundler";

const config = defineBuild({
	externals: ["effect", "@effect/platform"],
	devManifest: "preserve",
	meta: {
		localPaths: ["../mcp/lib/models/silk-effects", "../../website/lib/models/silk-effects"],
		tsdoc: {
			suppressWarnings: [{ messageId: "ae-forgotten-export", pattern: "_base" }],
			tagDefinitions: [{ tagName: "@since", syntaxKind: "block" }],
		},
	},
	transform: ({ pkg }) => {
		delete pkg.devDependencies;
		delete pkg.publishConfig;
		delete pkg.packageManager;
		delete pkg.devEngines;
		delete pkg.scripts;
		return pkg;
	},
});

export default config;

if (import.meta.main) {
	await runBuild(config, { cwd: import.meta.dirname, argv: process.argv.slice(2) });
}
