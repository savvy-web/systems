// packages/bundler/src/config.ts
import type { Json, MetaOptions, TargetGroupRef } from "@savvy-web/tsdown-plugins";

export interface OutputConfig {
	readonly console?: { readonly human?: boolean; readonly agent?: boolean; readonly ci?: boolean };
	readonly format?: "terminal" | "json" | "markdown" | "ci-annotations" | "silent";
}

export interface BuildConfigInput {
	readonly formats?: ReadonlyArray<"esm">;
	readonly externals?: ReadonlyArray<string>;
	readonly devManifest?: "preserve" | "resolve";
	readonly transform?: (args: { pkg: Json; targetGroup: TargetGroupRef }) => Json;
	readonly output?: OutputConfig;
	readonly meta?: MetaOptions;
}

export interface BuildConfig {
	readonly formats: ReadonlyArray<"esm">;
	readonly externals: ReadonlyArray<string>;
	readonly devManifest: "preserve" | "resolve";
	readonly transform?: ((args: { pkg: Json; targetGroup: TargetGroupRef }) => Json) | undefined;
	readonly output?: OutputConfig | undefined;
	readonly meta?: MetaOptions | undefined;
}

/** Normalize + validate a defineBuild config. Pure when imported; self-runs when entry (see run.ts). */
export function defineBuild(input: BuildConfigInput = {}): BuildConfig {
	const config: BuildConfig = {
		formats: input.formats ?? ["esm"],
		externals: input.externals ?? [],
		devManifest: input.devManifest ?? "preserve",
		transform: input.transform,
		output: input.output,
		meta: input.meta,
	};
	// Self-execution: only when this module's importer is the program entry.
	// run.ts performs the actual import.meta.main gate (it has access to the caller's meta).
	return config;
}

export interface ParsedArgs {
	readonly target: "dev" | "npm" | "meta";
	readonly watch: boolean;
}

export function parseArgs(argv: ReadonlyArray<string>): ParsedArgs {
	let target: "dev" | "npm" | "meta" = "dev";
	let watch = false;
	for (let i = 0; i < argv.length; i++) {
		if (argv[i] === "--target") {
			const v = argv[i + 1];
			if (v === "dev" || v === "npm" || v === "meta") target = v;
			i++;
		} else if (argv[i] === "--watch") {
			watch = true;
		}
	}
	return { target, watch };
}

export type { MetaOptions } from "@savvy-web/tsdown-plugins";
