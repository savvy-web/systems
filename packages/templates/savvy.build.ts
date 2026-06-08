import { defineBuild, runBuild } from "@savvy-web/bundler";

const config = defineBuild({
	externals: ["effect"],
	devManifest: "preserve",
	meta: {
		localPaths: ["../mcp/lib/models/templates", "../../website/lib/models/templates"],
		tsdoc: { suppressWarnings: [{ messageId: "ae-forgotten-export" }] },
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
