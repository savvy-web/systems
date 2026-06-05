import type { NormalizedExe } from "./config.js";

// Looser than TsdownBuild on purpose: the exe path passes an object literal, so the config stays unknown.
/** A minimal structural type for tsdown's build, kept loose so this package keeps no tsdown runtime dep (interface-only). */
export type ExeBuild = (config: unknown) => Promise<unknown>;

/** Options for compiling SEA binaries. */
export interface RunExeBuildOptions {
	readonly cwd: string;
	/** Directory the binaries are emitted into (e.g. dist/dev/pkg/bin). */
	readonly outDir: string;
	/** One fully-resolved spec per binary. */
	readonly specs: ReadonlyArray<NormalizedExe>;
	/** Injectable tsdown build (defaults to tsdown's build function). */
	readonly build?: ExeBuild | undefined;
}

/** Compile each SEA binary via tsdown's exe mode. One tsdown build per spec. */
export async function runExeBuild(options: RunExeBuildOptions): Promise<void> {
	const build: ExeBuild = options.build ?? ((await import("tsdown")).build as unknown as ExeBuild);
	for (const spec of options.specs) {
		await build({
			cwd: options.cwd,
			config: false,
			entry: [spec.entry],
			format: "esm",
			platform: "node",
			clean: false,
			// A SEA bundles every non-builtin import (nothing is resolvable from disk inside the SEA).
			deps: { alwaysBundle: (id: string) => !id.startsWith("node:") },
			exe: {
				fileName: spec.fileName,
				outDir: options.outDir,
				seaConfig: spec.seaConfig,
				targets: spec.targets,
			},
		});
	}
}
