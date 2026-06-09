import { defineBuild, runBuild } from "@savvy-web/bundler";

const config = defineBuild({
	// No `externals`: tsdown auto-externalizes everything declared in dependencies/
	// peerDependencies/optionalDependencies (effect, @effect/*, @savvy-web/silk-effects,
	// workspaces-effect are all declared), so listing them was redundant.
	devManifest: "preserve",
});

export default config;

if (import.meta.main) {
	await runBuild(config, { cwd: import.meta.dirname, argv: process.argv.slice(2) });
}
