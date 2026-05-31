import { NodeLibraryBuilder } from "@savvy-web/rslib-builder";

export default NodeLibraryBuilder.create({
	externals: [
		"@effect/platform",
		"@effect/platform-node",
		"@modelcontextprotocol/sdk",
		"@savvy-web/silk-effects",
		"effect",
		"workspaces-effect",
		"zod",
	],
	transform({ pkg }) {
		delete pkg.devDependencies;
		delete pkg.bundleDependencies;
		delete pkg.scripts;
		delete pkg.publishConfig;
		delete pkg.devEngines;
		return pkg;
	},
});
