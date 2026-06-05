import { defineBuild, runBuild } from "@savvy-web/bundler";

const config = defineBuild({
	meta: {
		localPaths: ["models"],
		tsdoc: { suppressWarnings: [{ messageId: "ae-forgotten-export", pattern: "_base" }] },
	},
});

export default config;

if (import.meta.main) {
	await runBuild(config, { cwd: import.meta.dirname, argv: process.argv.slice(2) });
}
