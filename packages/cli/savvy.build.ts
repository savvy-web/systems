import { defineBuild, runBuild } from "@savvy-web/bundler";

const config = defineBuild({
	externals: [
		"@effect/cli",
		"@effect/platform",
		"@effect/platform-node",
		"@savvy-web/silk-effects",
		"effect",
		"workspaces-effect",
	],
	devManifest: "preserve",
	transform: ({ pkg }) => {
		delete pkg.devDependencies;
		delete pkg.bundleDependencies;
		delete pkg.scripts;
		delete pkg.publishConfig;
		delete pkg.packageManager;
		delete pkg.devEngines;
		return pkg;
	},
});

export default config;

if (import.meta.main) {
	await runBuild(config, { cwd: import.meta.dirname, argv: process.argv.slice(2) });
}
