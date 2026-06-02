import { NodeLibraryBuilder } from "@savvy-web/rslib-builder";

export default NodeLibraryBuilder.create({
	externals: ["effect", "@effect/platform"],
	apiModel: {
		localPaths: ["../mcp/lib/models/silk-effects"],
		suppressWarnings: [{ messageId: "ae-forgotten-export", pattern: "_base" }],
		tsdoc: {
			tagDefinitions: [{ tagName: "@since", syntaxKind: "block" }],
		},
	},
	transform({ pkg }) {
		delete pkg.devDependencies;
		delete pkg.publishConfig;
		delete pkg.packageManager;
		delete pkg.devEngines;
		delete pkg.scripts;
		return pkg;
	},
});
