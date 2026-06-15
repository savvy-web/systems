// packages/tsdown-plugins/src/build/target-groups.ts
import { join } from "node:path";
import type { JsxConfig } from "../jsx/config.js";

/** A build group id: "dev" or any prod byte-variant id (e.g. "npm", "github", a custom key). */
export type TargetGroupId = string;

/** An output module format the build can emit. */
export type BuildFormat = "esm" | "cjs";

/** Bundling platform for the JS pass. Defaults to "node". Use "browser" for web runtime partitions. */
export type BuildPlatform = "node" | "browser" | "neutral";

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
	/** JS-pass platform. Defaults to "node"; set "browser" for an RSPress runtime partition. */
	readonly platform?: BuildPlatform | undefined;
	/** Output formats to emit. Defaults to esm-only when unset. */
	readonly format?: ReadonlyArray<BuildFormat> | undefined;
	/** Minify prod output (prod groups only; dev is never minified). Defaults to false. */
	readonly minify?: boolean | undefined;
	/** JSX transform settings to forward to rolldown's inputOptions. */
	readonly jsx?: JsxConfig | undefined;
	/**
	 * Compile-time global replacements forwarded to the build `define`. Merged AFTER the
	 * auto-injected `process.env.__PACKAGE_VERSION__` so a user key of the same name wins.
	 * Values are inserted verbatim (string literals must already be quoted).
	 */
	readonly define?: Record<string, string> | undefined;
	/**
	 * External packages whose declarations should be INLINED into the bundled dts
	 * (the rslib `dtsBundledPackages` equivalent). Maps to tsdown's `deps.onlyBundle`
	 * in the dts pass, so ONLY these node_modules packages are rolled into the
	 * `.d.ts` and every other dependency stays an external `import`. dts-pass-only:
	 * runtime JS bundling is unaffected.
	 */
	readonly bundledPackages?: ReadonlyArray<string> | undefined;
}

/**
 * The JS pass: per-module JavaScript, no declarations.
 *
 * The build runs TWO tsdown passes per TargetGroup to the SAME outDir:
 *  - pass 1 (this) emits per-module JS (`unbundle: true`) with `dts: false` and the
 *    default `clean: true`, so it starts from a fresh outDir;
 *  - pass 2 (`DerivedDtsPassOptions`) emits ONLY bundled declarations (`unbundle: false`,
 *    `dts: { emitDtsOnly: true }`) with `clean: false`, so it must NOT wipe pass 1.
 *
 * We cannot do this in a single pass: tsdown's `unbundle` maps to rolldown
 * `output.preserveModules` for the WHOLE build, and the dts plugin shares it — so one pass
 * gives EITHER per-module JS + per-module dts OR bundled JS + bundled dts. Per-module dts
 * breaks type portability (TS2883) when a package exports only its root entry, and bundling
 * the JS re-bundles workspace consumers (e.g. silk re-bundling silk-effects crashes at
 * runtime). The split keeps per-module JS (no re-bundle hazard) AND bundled, self-contained
 * declarations (no TS2883).
 */
export interface DerivedTsdownOptions {
	readonly outDir: string;
	readonly sourcemap: boolean;
	readonly minify: boolean;
	readonly format: ReadonlyArray<BuildFormat>;
	readonly unbundle: true;
	/** JS pass starts fresh; it owns the outDir before the dts pass appends to it. */
	readonly clean: true;
	readonly platform: BuildPlatform;
	/**
	 * Controls output file extensions. Always false for this builder.
	 *
	 * tsdown 0.22.2 finding (verified by running a real esm+cjs build of a type:module package):
	 * - With fixedExtension: false, tsdown emits ESM index.js plus CJS index.cjs for a
	 *   type:module package in the JS pass. There is no collision: tsdown derives the .js
	 *   extension for ESM and the .cjs extension for CJS automatically. An earlier M1.1 note
	 *   claimed the two formats collide on ambient .js under fixedExtension: false; that claim
	 *   was wrong and is corrected here.
	 * - This .js plus .cjs scheme is the one we want. It matches the rslib parity target, where
	 *   silk's dual-format output uses import: .js, require: .cjs, and a single types: .d.ts, and
	 *   it matches the flat manifest the emit-manifest transform writes.
	 * - Setting fixedExtension: true would instead yield .mjs plus .cjs (and .d.mts plus .d.cts),
	 *   which is NOT wanted, so dual-format needs no fixedExtension change and we leave it false.
	 * - The matching `.d.ts` / `.d.cts` declarations are emitted by the SEPARATE dts pass (see
	 *   `DerivedDtsPassOptions`), which keeps `unbundle: false` so the declarations are rolled up.
	 */
	readonly fixedExtension: false;
	readonly entry: Record<string, string>;
	/** JS pass emits no declarations; the dts pass owns them. */
	readonly dts: false;
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
	 */
	readonly cjsDefault?: boolean | undefined;
	/** JSX transform settings to forward to rolldown's inputOptions. */
	readonly jsx?: JsxConfig | undefined;
}

/**
 * The dts pass: bundled (rolled-up, self-contained) declarations only, no JS.
 *
 * Appended to the SAME outDir as the JS pass, so `clean` MUST be false (otherwise it wipes
 * the per-module JS the JS pass just wrote). `unbundle: false` makes rolldown roll the
 * declarations up per public entry, so a type re-exported through the root entry lands inline
 * in `index.d.ts` (fixing TS2883) instead of as a per-module sibling `.d.ts`.
 * `dts: { emitDtsOnly: true }` strips the JS chunks this pass would otherwise produce.
 *
 * Dual format: when `format` includes `cjs`, the dts pass still emits both `index.d.ts` (esm)
 * and `index.d.cts` (cjs) to the shared outDir.
 */
export interface DerivedDtsPassOptions {
	readonly outDir: string;
	readonly sourcemap: false;
	readonly format: ReadonlyArray<BuildFormat>;
	readonly unbundle: false;
	readonly clean: false;
	readonly platform: "node";
	readonly fixedExtension: false;
	readonly entry: Record<string, string>;
	readonly dts: { readonly tsconfig: string; readonly emitDtsOnly: true };
	readonly define: Record<string, string>;
	readonly isProd: boolean;
	/** JSX transform settings to forward to rolldown's inputOptions (dts compile honors JSX). */
	readonly jsx?: JsxConfig | undefined;
	/** External packages to inline into the bundled dts (tsdown `deps.onlyBundle`). */
	readonly bundledPackages?: ReadonlyArray<string> | undefined;
}

/** The output dir for a group: dev -> dist/dev/pkg, prod -> dist/prod/<group>/pkg. */
export const outDirFor = (cwd: string, group: TargetGroupId): string =>
	group === "dev" ? join(cwd, "dist/dev/pkg") : join(cwd, "dist/prod", group, "pkg");

/** Derive the JS-pass tsdown options for one TargetGroup (per-module JS, no dts). */
export function deriveTargetGroupOptions(options: DeriveOptions): DerivedTsdownOptions {
	const isProd = options.group !== "dev";
	const format = options.format ?? ["esm"];
	const hasCjs = format.includes("cjs");
	return {
		outDir: outDirFor(options.cwd, options.group),
		sourcemap: !isProd,
		// Minify is opt-in (default false) and prod-only: dev never minifies, and prod
		// minifies only when the caller asked. Node libraries favor readable output.
		minify: isProd && (options.minify ?? false),
		format,
		unbundle: true,
		clean: true,
		platform: options.platform ?? "node",
		// Always false: tsdown derives ESM .js plus CJS .cjs for a type:module package, the
		// scheme we want. fixedExtension: true would yield .mjs and break the manifest parity.
		fixedExtension: false,
		entry: options.entry,
		dts: false,
		define: {
			"process.env.__PACKAGE_VERSION__": JSON.stringify(options.version),
			...options.define,
		},
		isProd,
		// Only enable CJS interop when cjs is actually built; esm-only keeps tsdown's default.
		...(hasCjs ? { cjsDefault: true } : {}),
		...(options.jsx !== undefined ? { jsx: options.jsx } : {}),
	};
}

/** Derive the dts-pass tsdown options for one TargetGroup (bundled declarations only). */
export function deriveDtsPassOptions(options: DeriveOptions): DerivedDtsPassOptions {
	const isProd = options.group !== "dev";
	const format = options.format ?? ["esm"];
	return {
		outDir: outDirFor(options.cwd, options.group),
		sourcemap: false,
		format,
		unbundle: false,
		clean: false,
		platform: "node",
		fixedExtension: false,
		entry: options.entry,
		dts: { tsconfig: options.tsconfigPath, emitDtsOnly: true },
		define: {
			"process.env.__PACKAGE_VERSION__": JSON.stringify(options.version),
			...options.define,
		},
		isProd,
		...(options.jsx !== undefined ? { jsx: options.jsx } : {}),
		...(options.bundledPackages !== undefined ? { bundledPackages: options.bundledPackages } : {}),
	};
}
