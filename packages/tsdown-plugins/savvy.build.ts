// packages/tsdown-plugins/savvy.build.ts
// Escape-hatch self-build: imports buildTargetGroups from this package's OWN ./src
// (no built copy exists yet). tsx compiles the TS on the fly. See spec 3.1.
//
// Forgotten-export / TSDoc (ae-forgotten-export) check: under the bundler, the
// api-extractor pass only runs through generateMeta, which is invoked by
// `runBuild` for `--target meta` and for `--target prod` WHEN a `meta` option is
// configured (see packages/bundler/src/run.ts). The escape hatch calls
// buildTargetGroups directly with no `meta`, so api-extractor never runs here and
// there is nothing to suppress. This differs from the old rslib build, whose
// NodeLibraryBuilder ran api-extractor (with the `_base` suppression) during both
// build:dev and build:prod. tsdown-plugins has no `localPaths`, so it does not
// participate in the meta release-asset pipeline; the forgotten-export check is
// not part of its self-host build. The `_base` Context.Tag suppression that lived
// in rslib.config.ts's `apiModel` is therefore not carried over (no check fires).
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
	buildTargetGroups,
	defaultManifestTransform,
	packageJsonEntries,
	removeDeclarationMaps,
	writeResolvedTsconfig,
} from "./src/index.js";

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
	// tsdown/rolldown are type-only imports; keep effect external like the rslib config did.
	// typescript is a runtime dep (tsconfig-resolver uses the TS API); externalize it so the
	// 8 MB compiler is not inlined into the bundle.
	externals: ["effect", "tsdown", "rolldown", "typescript"],
	// Reproduce the rslib config's prod strip.
	transform: defaultManifestTransform,
});

// Strip declaration source-maps from the published prod pkg/ (the front door does this in
// runBuild; the escape hatch must do it itself). dev keeps them.
if (target === "prod") removeDeclarationMaps(join(cwd, "dist/prod/npm/pkg"));
