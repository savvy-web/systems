// packages/tsdown-plugins/src/build/target-groups.ts
import { join } from "node:path";

export type TargetGroupId = "dev" | "npm";

export interface DeriveOptions {
	readonly group: TargetGroupId;
	readonly cwd: string;
	readonly version: string;
	readonly entry: Record<string, string>;
	readonly tsconfigPath: string;
	readonly devManifest: "preserve" | "resolve";
	readonly externals?: ReadonlyArray<string>;
}

export interface DerivedTsdownOptions {
	readonly outDir: string;
	readonly sourcemap: boolean;
	readonly minify: boolean;
	readonly format: ReadonlyArray<"esm">;
	readonly unbundle: true;
	readonly platform: "node";
	/** Force .js/.d.ts extensions regardless of package type. fixedExtension: false overrides
	 * tsdown's node-platform default (fixedExtension: true → .mjs/.cjs), ensuring all output
	 * uses the ambient extension dictated by the package "type" field ("module" → .js). */
	readonly fixedExtension: false;
	readonly entry: Record<string, string>;
	readonly dts: { readonly tsconfig: string };
	readonly define: Record<string, string>;
	readonly isProd: boolean;
}

const outDirFor = (cwd: string, group: TargetGroupId): string =>
	group === "dev" ? join(cwd, "dist/dev/pkg") : join(cwd, "dist/prod", group, "pkg");

/** Derive the tsdown options for one TargetGroup (pure; orchestrator adds plugins + externals). */
export function deriveTargetGroupOptions(options: DeriveOptions): DerivedTsdownOptions {
	const isProd = options.group !== "dev";
	return {
		outDir: outDirFor(options.cwd, options.group),
		sourcemap: !isProd,
		minify: isProd,
		format: ["esm"],
		unbundle: true,
		platform: "node",
		// Override tsdown's node-platform default (fixedExtension: true → .mjs/.d.mts) so
		// output uses the package-type-ambient extension (.js/.d.ts for "type":"module").
		fixedExtension: false,
		entry: options.entry,
		dts: { tsconfig: options.tsconfigPath },
		define: { __PACKAGE_VERSION__: JSON.stringify(options.version) },
		isProd,
	};
}
