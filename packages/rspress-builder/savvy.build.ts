import { defineBuild, runBuild } from "@savvy-web/bundler";

const config = defineBuild({
	// @savvy-web/bundler + @savvy-web/tsdown-plugins are declared deps; tsdown auto-externalizes them.
	// No meta localPaths: this builder's api-model is not consumed by the mcp corpus.
});

export default config;

if (import.meta.main) {
	await runBuild(config, { cwd: import.meta.dirname, argv: process.argv.slice(2) });
}
