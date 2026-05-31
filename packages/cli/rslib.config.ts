import { NodeLibraryBuilder } from "@savvy-web/rslib-builder";

export default NodeLibraryBuilder.create({
	externals: [
		"@effect/cli",
		"@effect/platform",
		"@effect/platform-node",
		"@savvy-web/silk-effects",
		"effect",
		"workspaces-effect",
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
