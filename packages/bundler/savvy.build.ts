// packages/bundler/savvy.build.ts
// Escape-hatch self-build: imports buildTargetGroups from the already-built
// @savvy-web/tsdown-plugins dist/dev/pkg (the workspace link), NOT this package's
// own defineBuild/runBuild (which would need an already-built bundler — chicken/egg).
// See spec 3.2.
//
// Forgotten-export / TSDoc (ae-forgotten-export) check: under the bundler, the
// api-extractor pass only runs through generateMeta, which is invoked by `runBuild`
// for `--target meta` and for `--target prod` WHEN a `meta` option is configured
// (see packages/bundler/src/run.ts). The escape hatch calls buildTargetGroups directly with no `meta`,
// so api-extractor never runs here and there is nothing to suppress — same as tier 1.
// This differs from the old rslib build, whose NodeLibraryBuilder ran api-extractor
// during both build:dev and build:prod; the `_base` apiModel suppression that lived
// in rslib.config.ts is therefore not carried over (no check fires here).
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
	buildTargetGroups,
	defaultManifestTransform,
	packageJsonEntries,
	removeDeclarationMaps,
	writeResolvedTsconfig,
} from "@savvy-web/tsdown-plugins";

const cwd = import.meta.dirname;
const pkg = JSON.parse(readFileSync(join(cwd, "package.json"), "utf-8")) as { name: string; version: string };
const i = process.argv.indexOf("--target");
const rawTarget = i >= 0 ? process.argv[i + 1] : undefined;
if (rawTarget !== undefined && rawTarget !== "dev" && rawTarget !== "prod") {
	throw new Error(`Unknown --target: ${rawTarget}`);
}
const target = rawTarget ?? "dev";

await buildTargetGroups({
	cwd,
	version: pkg.version,
	entry: packageJsonEntries({ cwd }),
	tsconfigPath: writeResolvedTsconfig({ cwd }),
	groups: target === "prod" ? [{ id: "npm", name: pkg.name }] : [{ id: "dev", name: pkg.name }],
	devManifest: "preserve",
	// Port the exact externals from rslib.config.ts. @tsdown/exe is a runtime dep
	// lazily required by tsdown only when an exe build runs; it is not in the import
	// graph and was not bundled by rslib, so it stays out of externals.
	externals: ["effect", "tsdown", "@savvy-web/tsdown-plugins"],
	// Reproduce the rslib config's prod strip.
	transform: defaultManifestTransform,
});

// Strip declaration source-maps from the published prod pkg/ (the front door does this in
// runBuild; the escape hatch must do it itself). dev keeps them.
if (target === "prod") removeDeclarationMaps(join(cwd, "dist/prod/npm/pkg"));
