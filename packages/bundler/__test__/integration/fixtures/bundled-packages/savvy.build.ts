import { defineBuild, runBuild } from "@savvy-web/bundler";

const config = defineBuild({
	devManifest: "preserve",
	externals: ["effect"],
	bundledPackages: ["rolldown"],
});

export default config;

if (import.meta.main) {
	await runBuild(config, { cwd: import.meta.dirname, argv: process.argv.slice(2) });
}
