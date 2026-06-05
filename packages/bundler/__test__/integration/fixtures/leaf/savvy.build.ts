import { defineBuild, runBuild } from "@savvy-web/bundler";

const config = defineBuild({
	formats: ["esm"],
	externals: ["typescript"],
	devManifest: "preserve",
});

export default config;

if (import.meta.main) {
	await runBuild(config, { cwd: import.meta.dirname, argv: process.argv.slice(2) });
}
