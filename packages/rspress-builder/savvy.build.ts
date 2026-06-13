import { defineBuild, runBuild } from "@savvy-web/bundler";

const config = defineBuild({
	// @savvy-web/bundler + @savvy-web/tsdown-plugins are declared deps; tsdown auto-externalizes them.
	// tsdown-plugins is a DIRECT dep (not just transitive via bundler) because bundler's published .d.ts
	// externalizes it, so the BuildPlatform/CssOptions type refs in those declarations resolve against
	// tsdown-plugins at the consumer's install site; declaring it directly wires pnpm even if the transitive graph shifts.
	// No meta localPaths: this builder's api-model is not consumed by the mcp corpus.
});

export default config;

if (import.meta.main) {
	await runBuild(config, { cwd: import.meta.dirname, argv: process.argv.slice(2) });
}
