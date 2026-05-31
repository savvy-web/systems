import { NodeLibraryBuilder } from "@savvy-web/rslib-builder";

export default NodeLibraryBuilder.create({
	externals: ["typescript", "source-map-support"],
	format: ["esm", "cjs"],
	cjsInterop: true,
	exportsAsIndexes: true,
	dtsBundledPackages: ["@commitlint/types"],
	copyPatterns: [{ from: "./**/*.jsonc", context: "./src/public" }],
	apiModel: {
		suppressWarnings: [{ messageId: "ae-forgotten-export", pattern: "_base" }],
		tsdoc: {
			tagDefinitions: [
				{
					tagName: "@since",
					syntaxKind: "modifier",
				},
			],
		},
	},
	transform({ pkg }) {
		delete pkg.devDependencies;
		delete pkg.bundleDependencies;
		delete pkg.scripts;
		delete pkg.publishConfig;
		delete pkg.devEngines;
		return pkg;
	},
});
