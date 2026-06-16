import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
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
		// tsdown emits the bundled JS the SEA is compiled from to its top-level `outDir` — a separate
		// output from the binary in `exe.outDir`. Left unset it defaults to `<cwd>/dist`, leaving an
		// orphaned `dist/<entry>.mjs` beside the real binary that no manifest references and the
		// package never publishes. Point that intermediate at a throwaway scratch dir and drop it once
		// the binary is built, so only `exe.outDir` carries a deliverable.
		const scratch = mkdtempSync(join(tmpdir(), "savvy-exe-"));
		try {
			await build({
				cwd: options.cwd,
				config: false,
				entry: [spec.entry],
				format: "esm",
				platform: "node",
				clean: false,
				outDir: scratch,
				// A SEA bundles every non-builtin import (nothing is resolvable from disk inside the SEA).
				deps: { alwaysBundle: (id: string) => !id.startsWith("node:") },
				exe: {
					fileName: spec.fileName,
					outDir: options.outDir,
					seaConfig: spec.seaConfig,
					targets: spec.targets,
				},
			});
		} finally {
			rmSync(scratch, { recursive: true, force: true });
		}
	}
}
