import { defineBuild, runBuild } from "@savvy-web/bundler";

const config = defineBuild({
	// No `externals`: tsdown auto-externalizes everything declared in dependencies/
	// peerDependencies/optionalDependencies (effect, @effect/*, @modelcontextprotocol/sdk,
	// @savvy-web/silk-effects, workspaces-effect, zod are all declared), so the list was redundant.
	devManifest: "preserve",
});

export default config;

if (import.meta.main) {
	await runBuild(config, { cwd: import.meta.dirname, argv: process.argv.slice(2) });
}
