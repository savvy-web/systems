// packages/tsdown-plugins/src/build/target-groups.ts
import { join } from "node:path";
import type { JsxConfig } from "../jsx/config.js";

/** A build group id: "dev" or any prod byte-variant id (e.g. "npm", "github", a custom key). */
export type TargetGroupId = string;

/** An output module format the build can emit. */
export type BuildFormat = "esm" | "cjs";

/** A prod/dev group to build: its folder id and the resolved package name its manifest carries. */
export interface BuildGroupSpec {
	readonly id: TargetGroupId;
	readonly name: string;
}

export interface DeriveOptions {
	readonly group: TargetGroupId;
	readonly cwd: string;
	readonly version: string;
	readonly entry: Record<string, string>;
	readonly tsconfigPath: string;
	readonly devManifest: "preserve" | "resolve";
	readonly externals?: ReadonlyArray<string>;
	/** Output formats to emit. Defaults to esm-only when unset. */
	readonly format?: ReadonlyArray<BuildFormat> | undefined;
	/** JSX transform settings to forward to rolldown's inputOptions. */
	readonly jsx?: JsxConfig | undefined;
}

export interface DerivedTsdownOptions {
	readonly outDir: string;
	readonly sourcemap: boolean;
	readonly minify: boolean;
	readonly format: ReadonlyArray<BuildFormat>;
	readonly unbundle: true;
	readonly platform: "node";
	/**
	 * Controls output file extensions. Always false for this builder.
	 *
	 * tsdown 0.22.2 finding (verified by running a real esm+cjs build of a type:module package):
	 * - With fixedExtension: false, tsdown already emits ESM index.js plus CJS index.cjs (and
	 *   index.d.ts plus index.d.cts) for a type:module package. There is no collision: tsdown
	 *   derives the .js extension for ESM and the .cjs extension for CJS automatically. An earlier
	 *   M1.1 note claimed the two formats collide on ambient .js under fixedExtension: false; that
	 *   claim was wrong and is corrected here.
	 * - This .js plus .cjs scheme is the one we want. It matches the rslib parity target, where
	 *   silk's dual-format output uses import: .js, require: .cjs, and a single types: .d.ts, and
	 *   it matches the flat manifest the emit-manifest transform writes.
	 * - Setting fixedExtension: true would instead yield .mjs plus .cjs (and .d.mts plus .d.cts),
	 *   which is NOT wanted, so dual-format needs no fixedExtension change and we leave it false.
	 * - dts emission produces a CJS declaration (.d.cts) when cjs is in format; tsdown's
	 *   DtsOptions.cjsReexport can make it a re-export stub, but the default full second pass
	 *   is fine here.
	 */
	readonly fixedExtension: false;
	readonly entry: Record<string, string>;
	readonly dts: { readonly tsconfig: string };
	readonly define: Record<string, string>;
	readonly isProd: boolean;
	/**
	 * CJS named-export interop, the equivalent of rslib's cjsInterop: true. This is the real
	 * tsdown option name, so it threads straight to the build with no rename.
	 *
	 * tsdown 0.22.2 finding (verified against the dist Options dts plus the build source):
	 * - cjsDefault is a top-level boolean, default true. The build maps it to rolldown's
	 *   output.exports: cjsDefault ? "auto" : "named", and also silences the MIXED_EXPORT
	 *   warning. With "auto", a module whose only default-style export is a single default
	 *   becomes module.exports = value, while named exports stay attached, so a require() call
	 *   returns the value directly and named exports survive, the interop rslib gives with
	 *   cjsInterop: true.
	 * - We only set it (to true) when cjs is in the format, so esm-only builds leave the tsdown
	 *   default untouched and stay byte-identical to before.
	 * - CJS declarations (.d.cts) are emitted automatically by the dts pass when both esm and
	 *   cjs are in format (DtsOptions.cjsReexport only switches the full second pass to a
	 *   re-export stub, which we do not want), so no extra flag is needed for declarations.
	 */
	readonly cjsDefault?: boolean | undefined;
	/** JSX transform settings to forward to rolldown's inputOptions. */
	readonly jsx?: JsxConfig | undefined;
}

const outDirFor = (cwd: string, group: TargetGroupId): string =>
	group === "dev" ? join(cwd, "dist/dev/pkg") : join(cwd, "dist/prod", group, "pkg");

/** Derive the tsdown options for one TargetGroup (pure; orchestrator adds plugins + externals). */
export function deriveTargetGroupOptions(options: DeriveOptions): DerivedTsdownOptions {
	const isProd = options.group !== "dev";
	const format = options.format ?? ["esm"];
	const hasCjs = format.includes("cjs");
	return {
		outDir: outDirFor(options.cwd, options.group),
		sourcemap: !isProd,
		minify: isProd,
		format,
		unbundle: true,
		platform: "node",
		// Always false: tsdown derives ESM .js plus CJS .cjs for a type:module package, the
		// scheme we want. fixedExtension: true would yield .mjs and break the manifest parity.
		fixedExtension: false,
		entry: options.entry,
		dts: { tsconfig: options.tsconfigPath },
		define: { __PACKAGE_VERSION__: JSON.stringify(options.version) },
		isProd,
		// Only enable CJS interop when cjs is actually built; esm-only keeps tsdown's default.
		...(hasCjs ? { cjsDefault: true } : {}),
		...(options.jsx !== undefined ? { jsx: options.jsx } : {}),
	};
}
