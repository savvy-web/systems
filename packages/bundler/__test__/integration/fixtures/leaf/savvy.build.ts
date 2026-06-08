import { defineBuild } from "../../../../src/config.js";
import { runBuild } from "../../../../src/run.js";

const config = defineBuild({
	formats: ["esm"],
	externals: ["typescript"],
	devManifest: "preserve",
});

export default config;

if (import.meta.main) {
	await runBuild(config, { cwd: import.meta.dirname, argv: process.argv.slice(2) });
}
