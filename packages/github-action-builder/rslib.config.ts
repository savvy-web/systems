import { NodeLibraryBuilder } from "@savvy-web/rslib-builder";

export default NodeLibraryBuilder.create({
	apiModel: {
		tsdoc: {
			tagDefinitions: [
				{ tagName: "@schema", syntaxKind: "modifier" },
				{ tagName: "@layer", syntaxKind: "modifier" },
				{ tagName: "@service", syntaxKind: "modifier" },
				{ tagName: "@error", syntaxKind: "modifier" },
			],
		},
	},
	copyPatterns: [
		{
			from: "./**/*.json",
			context: "./src/public",
		},
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
