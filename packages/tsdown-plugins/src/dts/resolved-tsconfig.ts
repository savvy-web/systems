// packages/tsdown-plugins/src/dts/resolved-tsconfig.ts
import { existsSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { isAbsolute, join, resolve } from "node:path";
import { TsconfigLoaderSync } from "@effected/tsconfig-json";
import { tsconfigSyncOptions } from "../tsconfig/sync-options.js";

/** @public */
export interface ResolvedTsconfigOptions {
	/** Absolute package root. */
	readonly cwd: string;
	/** TS `compilerOptions.jsx` override (e.g. "react-jsx"); wins over the resolved config. */
	readonly jsx?: string | undefined;
	/** TS `compilerOptions.jsxImportSource` override (e.g. "react"); wins over the resolved config. */
	readonly jsxImportSource?: string | undefined;
}

/** @public */
export interface ResolvedTsconfig {
	readonly compilerOptions: Record<string, unknown>;
	readonly include: ReadonlyArray<string>;
	readonly exclude: ReadonlyArray<string>;
}

/**
 * The dts-pass deltas layered over whatever the package's own tsconfig declares. The shared
 * `ecma.json` base sets `composite`/`incremental` true and points `tsBuildInfoFile` at a build
 * info file; the declaration pass must never skip emit on stale build info, so all three are
 * forced off here. `declarationMap` is forced on for the emitted maps. `declaration` and
 * `emitDeclarationOnly` are forced on/off respectively because this pass's entire job is
 * emitting declarations — it cannot honor a consumer's `declaration: false`; TypeScript's
 * emitter asserts (`Debug Failure` in `getSourceMappingURL`) when `declarationMap` is
 * requested without `declaration`.
 *
 * @internal
 */
const DTS_OVERLAY: Record<string, unknown> = {
	declaration: true,
	declarationMap: true,
	emitDeclarationOnly: false,
	composite: false,
	incremental: false,
	tsBuildInfoFile: undefined,
};

/**
 * The compiler options used when a package has no own `tsconfig.json` — today's synthesized
 * defaults, preserved verbatim. The e2e `leaf` / `leaf-escape` fixtures build without one, so
 * absence is a supported case, not an error.
 *
 * @internal
 */
function fallbackCompilerOptions(cwd: string): Record<string, unknown> {
	return {
		declaration: true,
		emitDeclarationOnly: false,
		rootDir: cwd,
		outDir: join(cwd, "dist"),
		declarationDir: join(cwd, "dist"),
		typeRoots: [join(cwd, "node_modules/@types"), join(cwd, "types")],
		types: ["node"],
	};
}

/**
 * Build the portable absolute-path tsconfig object for the dts pass.
 *
 * @remarks
 * Resolves the package's own `<cwd>/tsconfig.json` (which extends the shared
 * `ecma.json` base) through `@effected/tsconfig-json`'s `TsconfigLoaderSync`, so the
 * result carries the package's real effective options — target, module, lib, strict,
 * jsx — with `${configDir}` already substituted to absolute paths. Only the dts-pass
 * overlay (composite/incremental/tsBuildInfoFile forced off, declarationMap forced on)
 * and an explicit jsx override are layered on top.
 *
 * `include`/`exclude` are NOT taken from the resolved config. The shared base includes
 * `__test__` and `lib` sources, which have no business in a declaration program; the
 * narrow list below is dts-pass-specific and deliberately held fixed.
 *
 * @public
 */
export function buildResolvedTsconfig(options: ResolvedTsconfigOptions): ResolvedTsconfig {
	const cwd = options.cwd;
	const ownConfig = join(cwd, "tsconfig.json");
	let base: Record<string, unknown>;
	if (existsSync(ownConfig)) {
		try {
			base = { ...TsconfigLoaderSync.resolve(ownConfig, tsconfigSyncOptions).compilerOptions };
		} catch (error) {
			// A config that EXISTS but will not resolve — malformed JSON, or an `extends` that cannot be
			// located — is a defect, not a fallback case, so fail loudly. Synthesizing defaults here
			// would emit declarations compiled under the WRONG options while still reporting a green
			// build: the tsconfig this function returns is written to a temp file that extends the base
			// by absolute path and never references the broken source, so the dts pass itself sees
			// nothing wrong. A consumer running only `build:*` would never learn about it.
			// `resolvePortableTsconfig` below throws on the same failure; these two must not diverge.
			// Genuine ABSENCE stays a supported case and is handled by the `else` branch.
			const message = error instanceof Error ? error.message : String(error);
			throw new Error(`Cannot resolve tsconfig at ${ownConfig}: ${message}`, { cause: error });
		}
	} else {
		base = fallbackCompilerOptions(cwd);
	}
	return {
		compilerOptions: {
			...base,
			...DTS_OVERLAY,
			...(options.jsx !== undefined ? { jsx: options.jsx } : {}),
			...(options.jsxImportSource !== undefined ? { jsxImportSource: options.jsxImportSource } : {}),
		},
		include: [
			join(cwd, "src/**/*.ts"),
			join(cwd, "src/**/*.mts"),
			join(cwd, "src/**/*.tsx"),
			join(cwd, "types/*.d.ts"),
			join(cwd, "package.json"),
		],
		exclude: [join(cwd, "node_modules"), join(cwd, "dist/**/*")],
	};
}

/**
 * Write the resolved tsconfig to a temp file and return its absolute path.
 *
 * @public
 */
export function writeResolvedTsconfig(options: ResolvedTsconfigOptions): string {
	const cfg = buildResolvedTsconfig(options);
	const path = join(tmpdir(), `tsconfig-bundle-${process.pid}-${options.cwd.replace(/[^\w]/g, "_")}.json`);
	writeFileSync(path, `${JSON.stringify(cfg, null, "\t")}\n`, "utf-8");
	return path;
}

/**
 * Derive a dts-EMIT variant of an already-written resolved tsconfig that adds
 * `stableTypeOrdering: true`, and return its path. This makes the TypeScript declaration emitter
 * (rolldown-plugin-dts on `typescript@6`) order union/type members deterministically, so a
 * multi-union `.d.ts` (e.g. an Effect `Layer.Layer<…>` requirement channel) does not flip member
 * order across otherwise-identical builds (#156). It is kept in a SEPARATE file from the
 * api-extractor tsconfig on purpose: `@microsoft/api-extractor` pins `typescript ~5.9`, which
 * predates the flag and hard-errors on the unknown compiler option — so only the emit passes
 * (which run on TS6) ever see it, while the api-extractor compile reads the original clean config.
 *
 * Best-effort: if the base tsconfig cannot be read or parsed (e.g. a synthetic test path that was
 * never written), the original path is returned unchanged — the emit then simply keeps TS's
 * default ordering rather than aborting the build at this layer.
 *
 * @public
 */
export function writeDtsEmitTsconfig(resolvedTsconfigPath: string): string {
	const absBase = isAbsolute(resolvedTsconfigPath) ? resolvedTsconfigPath : resolve(resolvedTsconfigPath);
	// Best-effort: a base that does not exist (e.g. a synthetic test path) gets no variant — return it
	// unchanged so the emit keeps TS's default ordering rather than aborting at this layer.
	if (!existsSync(absBase)) return resolvedTsconfigPath;
	// A thin wrapper that `extends` the base by ABSOLUTE path and adds only `stableTypeOrdering`. Written
	// to the OS temp dir (NOT next to the base) so it never pollutes the source tree when the base is an
	// in-tree `tsconfig.json`, and the absolute `extends` keeps the base's own relative `extends`/paths
	// resolving from the base's location. The filename is deterministic per (pid, base), so repeated calls
	// within a process overwrite the same file rather than accumulating; cross-process temp files are left
	// for the OS to reap, intentionally consistent with `writeResolvedTsconfig`'s pid-scoped temp pattern.
	const cfg = { extends: absBase, compilerOptions: { stableTypeOrdering: true } };
	const path = join(tmpdir(), `tsconfig-dts-emit-${process.pid}-${absBase.replace(/[^\w]/g, "_")}.json`);
	writeFileSync(path, `${JSON.stringify(cfg, null, "\t")}\n`, "utf-8");
	return path;
}
