// packages/tsdown-plugins/src/dts/resolved-tsconfig.ts
import { existsSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { isAbsolute, join, resolve } from "node:path";

/** @public */
export interface ResolvedTsconfigOptions {
	/** Absolute package root. */
	readonly cwd: string;
	/** Explicit `types` to forward (default ["node"]). Pulled from the project tsconfig by the caller. */
	readonly types?: ReadonlyArray<string> | undefined;
	/** TS `compilerOptions.jsx` to forward into the dts tsconfig (e.g. "react-jsx"). */
	readonly jsx?: string | undefined;
	/** TS `compilerOptions.jsxImportSource` to forward (e.g. "react"). */
	readonly jsxImportSource?: string | undefined;
}

/** @public */
export interface ResolvedTsconfig {
	readonly compilerOptions: Record<string, unknown>;
	readonly include: ReadonlyArray<string>;
	readonly exclude: ReadonlyArray<string>;
}

/**
 * Build the portable absolute-path tsconfig object (ported from rslib writeBundleTempConfig).
 *
 * @public
 */
export function buildResolvedTsconfig(options: ResolvedTsconfigOptions): ResolvedTsconfig {
	const cwd = options.cwd;
	return {
		compilerOptions: {
			// emit settings for declaration-only dts
			declaration: true,
			emitDeclarationOnly: false,
			declarationMap: true,
			// portability: absolute roots + explicit types so pnpm symlinks resolve
			rootDir: cwd,
			outDir: join(cwd, "dist"),
			declarationDir: join(cwd, "dist"),
			typeRoots: [join(cwd, "node_modules/@types"), join(cwd, "types")],
			types: options.types ? [...options.types] : ["node"],
			// never skip emit on stale build info
			composite: false,
			incremental: false,
			tsBuildInfoFile: undefined,
			...(options.jsx !== undefined ? { jsx: options.jsx } : {}),
			...(options.jsxImportSource !== undefined ? { jsxImportSource: options.jsxImportSource } : {}),
		},
		include: [
			join(cwd, "src/**/*.ts"),
			join(cwd, "src/**/*.mts"),
			join(cwd, "src/**/*.tsx"),
			join(cwd, "types/*.ts"),
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
	// resolving from the base's location.
	const cfg = { extends: absBase, compilerOptions: { stableTypeOrdering: true } };
	const path = join(tmpdir(), `tsconfig-dts-emit-${process.pid}-${absBase.replace(/[^\w]/g, "_")}.json`);
	writeFileSync(path, `${JSON.stringify(cfg, null, "\t")}\n`, "utf-8");
	return path;
}
