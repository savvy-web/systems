// packages/tsdown-plugins/src/dts/resolved-tsconfig.ts
import { writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

export interface ResolvedTsconfigOptions {
	/** Absolute package root. */
	readonly cwd: string;
	/** Explicit `types` to forward (default ["node"]). Pulled from the project tsconfig by the caller. */
	readonly types?: ReadonlyArray<string>;
}

export interface ResolvedTsconfig {
	readonly compilerOptions: Record<string, unknown>;
	readonly include: ReadonlyArray<string>;
	readonly exclude: ReadonlyArray<string>;
}

/** Build the portable absolute-path tsconfig object (ported from rslib writeBundleTempConfig). */
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

/** Write the resolved tsconfig to a temp file and return its absolute path. */
export function writeResolvedTsconfig(options: ResolvedTsconfigOptions): string {
	const cfg = buildResolvedTsconfig(options);
	const path = join(tmpdir(), `tsconfig-bundle-${process.pid}-${options.cwd.replace(/[^\w]/g, "_")}.json`);
	writeFileSync(path, `${JSON.stringify(cfg, null, "\t")}\n`, "utf-8");
	return path;
}
