import { defineBuild, runBuild } from "@savvy-web/bundler";

const config = defineBuild({
	meta: {
		localPaths: ["../mcp/lib/models/rspress-builder", "../../website/lib/models/rspress-builder"],
	},
});

export default config;

if (import.meta.main) {
	await runBuild(config, { cwd: import.meta.dirname, argv: process.argv.slice(2) });
}
