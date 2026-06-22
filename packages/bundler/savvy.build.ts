// packages/bundler/savvy.build.ts
// Escape-hatch self-build: imports buildTargetGroups from the already-built
// @savvy-web/tsdown-plugins dist/dev/pkg (the workspace link), NOT this package's
// own defineBuild/runBuild (which would need an already-built bundler — chicken/egg).
// See spec 3.2.
//
// Meta / forgotten-export check: --target prod calls runMetaPass (api-extractor) via
// the shared helper, mirroring what runBuild does for packages that set meta. This
// emits dist/prod/npm/meta/bundler.api.json and copies the model into meta.localPaths.
// ae-*/tsdoc-* warnings that are not yet suppressed appear in the rendered report and
// issues.json but do not fail a local build (only hard errors crash; CI escalates
// ae-forgotten-export to a hard error).
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { MetaOptions, PublishTargets, RenderedOutput } from "@savvy-web/tsdown-plugins";
import {
	BuildCollector,
	ReportPipelineLive,
	buildTargetGroups,
	defaultManifestTransform,
	packageJsonEntries,
	removeDeclarationMaps,
	renderReport,
	resolveTargets,
	runMetaPass,
	writeIssuesArtifact,
	writeResolvedTsconfig,
	writeTargetsBinding,
} from "@savvy-web/tsdown-plugins";
import { Effect } from "effect";

const cwd = import.meta.dirname;
const pkg = JSON.parse(readFileSync(join(cwd, "package.json"), "utf-8")) as {
	name: string;
	version: string;
	publishConfig?: { targets?: PublishTargets };
	exports?: Record<string, string>;
};
const i = process.argv.indexOf("--target");
const rawTarget = i >= 0 ? process.argv[i + 1] : undefined;
if (rawTarget !== undefined && rawTarget !== "dev" && rawTarget !== "prod") {
	throw new Error(`Unknown --target: ${rawTarget}`);
}
const target = rawTarget ?? "dev";

const collector = new BuildCollector();
const verbose = process.argv.includes("--verbose");

const meta: MetaOptions = {
	localPaths: ["../mcp/lib/models/bundler", "../../website/lib/models/bundler"],
	// tsdoc filled by Task 6 once diagnostics are known; start empty.
	tsdoc: {},
};

const tsconfigPath = writeResolvedTsconfig({ cwd });

try {
	await buildTargetGroups({
		cwd,
		version: pkg.version,
		entry: packageJsonEntries({ cwd }),
		tsconfigPath,
		groups: target === "prod" ? [{ id: "npm", name: pkg.name }] : [{ id: "dev", name: pkg.name }],
		devManifest: "preserve",
		// Port the exact externals from rslib.config.ts. @tsdown/exe is a runtime dep
		// lazily required by tsdown only when an exe build runs; it is not in the import
		// graph and was not bundled by rslib, so it stays out of externals.
		externals: ["effect", "tsdown", "@savvy-web/tsdown-plugins"],
		// Reproduce the rslib config's prod strip.
		transform: defaultManifestTransform,
		collector,
		verbose,
	});

	// Strip declaration source-maps from the published prod pkg/ (the front door does this in
	// runBuild; the escape hatch must do it itself). dev keeps them.
	if (target === "prod") {
		removeDeclarationMaps(join(cwd, "dist/prod/npm/pkg"));
		// Emit the dist/prod/targets.json binding the release action consumes — the front
		// door (runBuild) writes this; the escape hatch must too, or the action falls back
		// to the dist/dev directory. Derive the targets from publishConfig.targets (not a
		// hardcoded map) so the binding tracks the manifest.
		const targets = pkg.publishConfig?.targets;
		if (targets === undefined) {
			throw new Error("Missing package.json publishConfig.targets for --target prod");
		}
		writeTargetsBinding(cwd, resolveTargets({ targets, baseName: pkg.name }));
		// Emit the api-model meta bundle and copy it into the local consumer paths.
		// Mirrors what runBuild does for --target prod when meta is configured.
		const ci = process.env.CI === "true" || process.env.GITHUB_ACTIONS === "true";
		await runMetaPass({
			cwd,
			packageName: pkg.name,
			tsconfigPath,
			groups: [{ id: "npm", name: pkg.name }],
			entries: packageJsonEntries({ cwd }),
			exportsMap: pkg.exports,
			meta,
			collector,
			ci,
		});
	}
} finally {
	// Always render the report — even if the build threw — so captured diagnostics are surfaced
	// before the error propagates (parity with the front-door runBuild).
	const rendered = await Effect.runPromise(
		renderReport(collector.snapshot(pkg.name), {
			verbose,
			noColor: process.env.NO_COLOR !== undefined || !process.stdout.isTTY,
		}).pipe(Effect.provide(ReportPipelineLive)),
	);
	for (const out of rendered as ReadonlyArray<RenderedOutput>) process.stdout.write(`${out.content}\n`);
	// Persist the structured diagnostics artifact for every target — matches run.ts:500/505.
	// Best-effort: a write failure must never mask the build outcome.
	try {
		writeIssuesArtifact({ cwd, target, reports: collector.snapshot(pkg.name) });
	} catch {
		// intentionally swallowed
	}
}
