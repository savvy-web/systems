import { defineBuild, runBuild } from "@savvy-web/bundler";

const config = defineBuild({ exe: { fileName: "exe-fixture" } });
export default config;

if (import.meta.main) {
	await runBuild(config, { cwd: import.meta.dirname, argv: process.argv.slice(2) });
}
