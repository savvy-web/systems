import { defineBuild, runBuild } from "@savvy-web/bundler";

const config = defineBuild({
	externals: [
		"@actions/cache",
		"@actions/core",
		"@actions/exec",
		"@actions/github",
		"@actions/tool-cache",
		"@effect/cluster",
		"@effect/platform",
		"@effect/platform-node",
		"@effect/rpc",
		"@effect/sql",
		"@octokit/auth-app",
		"effect",
	],
	devManifest: "preserve",
	meta: {
		localPaths: ["../mcp/lib/models/github-action-effects"],
		tsdoc: { suppressWarnings: [{ messageId: "ae-forgotten-export", pattern: "_base" }] },
	},
	transform: ({ pkg }) => {
		delete pkg.devDependencies;
		delete pkg.bundleDependencies;
		delete pkg.scripts;
		delete pkg.publishConfig;
		delete pkg.packageManager;
		delete pkg.devEngines;
		return pkg;
	},
});

export default config;

if (import.meta.main) {
	await runBuild(config, { cwd: import.meta.dirname, argv: process.argv.slice(2) });
}
