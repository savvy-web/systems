import { NodeLibraryBuilder } from "@savvy-web/rslib-builder";

export default NodeLibraryBuilder.create({
	// tsdown/rolldown are type-only imports; keep effect external like the other packages.
	externals: ["effect", "tsdown", "rolldown"],
	// Suppress the Context.Tag `_base` forgotten-export messages (Effect emits a private
	// intermediate base class per Context.Tag). Without this, CI's forgottenExports="error"
	// fails the build. Matches the silk-effects / github-action-effects convention.
	apiModel: {
		suppressWarnings: [{ messageId: "ae-forgotten-export", pattern: "_base" }],
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
