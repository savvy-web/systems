// packages/bundler/src/run.ts
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { BuildTargetGroupsOptions, RenderedOutput } from "@savvy-web/tsdown-plugins";
import {
	ReportPipelineLive,
	packageJsonEntries,
	buildTargetGroups as realBuildTargetGroups,
	renderReport,
	writeResolvedTsconfig,
} from "@savvy-web/tsdown-plugins";
import { Effect } from "effect";
import type { BuildConfig } from "./config.js";
import { parseArgs } from "./config.js";

export interface RunOptions {
	readonly cwd: string;
	readonly argv: ReadonlyArray<string>;
	/** Injectable for tests. */
	readonly buildTargetGroups?: (o: BuildTargetGroupsOptions) => Promise<void>;
	/** Injectable for tests: consumes rendered output (defaults to process.stdout.write). */
	readonly writeOutput?: (output: RenderedOutput) => void;
	/** Injectable for tests: returns the package version string. */
	readonly readVersion?: () => string;
	/** Injectable for tests: returns the package name. */
	readonly readPackageName?: () => string;
	/** Injectable for tests: writes the resolved tsconfig and returns its path (defaults to writeResolvedTsconfig, which writes to the OS temp dir). */
	readonly writeTsconfig?: (cwd: string) => string;
}

/** Read and parse package.json at cwd, returning an empty object on any error. */
function readPackageJson(cwd: string): { name?: string; version?: string; exports?: unknown; bin?: unknown } {
	try {
		return JSON.parse(readFileSync(join(cwd, "package.json"), "utf-8")) as {
			name?: string;
			version?: string;
			exports?: unknown;
			bin?: unknown;
		};
	} catch {
		return {};
	}
}

/** Run a build from a normalized config. Pure orchestration; all IO injectable. */
export async function runBuild(config: BuildConfig, options: RunOptions): Promise<void> {
	const { target } = parseArgs(options.argv);
	const build = options.buildTargetGroups ?? realBuildTargetGroups;
	const cwd = options.cwd;
	const pkg = readPackageJson(cwd);

	const version = options.readVersion ? options.readVersion() : (pkg.version ?? "0.0.0");
	const packageName = options.readPackageName ? options.readPackageName() : (pkg.name ?? "unknown");

	const writeTsconfig = options.writeTsconfig ?? ((c: string) => writeResolvedTsconfig({ cwd: c }));
	const tsconfigPath = writeTsconfig(cwd);

	const startMs = Date.now();
	await build({
		cwd,
		version,
		entry: packageJsonEntries({ pkg, cwd }),
		tsconfigPath,
		groups: [target],
		devManifest: config.devManifest,
		externals: config.externals,
		...(config.transform !== undefined ? { transform: config.transform } : {}),
	});
	const totalMs = Date.now() - startMs;

	// Build a minimal BuildReport from the completed build
	const entries = Object.keys(packageJsonEntries({ pkg, cwd }));
	const report = {
		package: packageName,
		targetGroups: [
			{
				id: target,
				entries,
				emittedFiles: [],
				timings: { totalMs },
				warnings: [],
				errors: [],
			},
		],
	};

	const explicitFormat = config.output?.format;
	const rendered = await Effect.runPromise(
		renderReport([report], {
			...(explicitFormat !== undefined ? { explicitFormat } : {}),
			noColor: process.env.NO_COLOR !== undefined || !process.stdout.isTTY,
		}).pipe(Effect.provide(ReportPipelineLive)),
	);

	const writeOutput = options.writeOutput ?? ((o: RenderedOutput) => process.stdout.write(`${o.content}\n`));
	for (const output of rendered) {
		writeOutput(output);
	}
}
