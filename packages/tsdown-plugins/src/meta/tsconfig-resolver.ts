// packages/tsdown-plugins/src/meta/tsconfig-resolver.ts
import { existsSync } from "node:fs";
import { join } from "node:path";
import type { ParseConfigFileHost, ParsedCommandLine } from "typescript";
import {
	JsxEmit,
	ModuleDetectionKind,
	ModuleKind,
	ModuleResolutionKind,
	NewLineKind,
	ScriptTarget,
	flattenDiagnosticMessageText,
	getParsedCommandLineOfConfigFile,
	sys,
} from "typescript";

/**
 * JSON schema URL for tsconfig.json files.
 * @internal
 */
const TSCONFIG_SCHEMA_URL = "https://json.schemastore.org/tsconfig";

/**
 * Boolean compiler options preserved in the portable config.
 *
 * @remarks
 * These options affect type checking and module semantics without producing
 * build artifacts. Emit-related options are excluded.
 *
 * @internal
 */
const PRESERVED_BOOLEAN_OPTIONS = [
	"strict",
	"strictNullChecks",
	"strictFunctionTypes",
	"strictBindCallApply",
	"strictPropertyInitialization",
	"noImplicitAny",
	"noImplicitThis",
	"alwaysStrict",
	"noUnusedLocals",
	"noUnusedParameters",
	"exactOptionalPropertyTypes",
	"noImplicitReturns",
	"noFallthroughCasesInSwitch",
	"noUncheckedIndexedAccess",
	"noImplicitOverride",
	"noPropertyAccessFromIndexSignature",
	"allowUnusedLabels",
	"allowUnreachableCode",
	"esModuleInterop",
	"allowSyntheticDefaultImports",
	"forceConsistentCasingInFileNames",
	"resolveJsonModule",
	"isolatedModules",
	"verbatimModuleSyntax",
	"skipLibCheck",
	"skipDefaultLibCheck",
	"downlevelIteration",
	"importHelpers",
	"preserveConstEnums",
	"isolatedDeclarations",
	"allowImportingTsExtensions",
	"rewriteRelativeImportExtensions",
	"allowArbitraryExtensions",
	"useDefineForClassFields",
	"noLib",
	"preserveSymlinks",
] as const;

/**
 * String compiler options preserved in the portable config.
 * @internal
 */
const PRESERVED_STRING_OPTIONS = ["jsxFactory", "jsxFragmentFactory", "jsxImportSource", "reactNamespace"] as const;

/**
 * Compiler options with enum values converted to their string equivalents.
 *
 * @remarks
 * Open-ended record because TypeScript compiler options vary by version.
 *
 * @public
 */
export interface ResolvedCompilerOptions {
	[key: string]: unknown;
}

/**
 * Portable, JSON-serializable tsconfig.json (compilerOptions-only).
 *
 * @remarks
 * Designed for virtual TypeScript environments (shiki/Twoslash, API Extractor)
 * where file paths and emit settings are controlled externally. Holds no
 * machine-specific absolute paths and no emit/path/file-selection options.
 *
 * @public
 */
export interface PortableTsconfig {
	/** JSON schema for IDE support. */
	$schema: string;
	/** Compiler options with enum values converted to strings. */
	compilerOptions: ResolvedCompilerOptions;
}

/**
 * Resolves a TypeScript `ParsedCommandLine` to a portable, JSON-serializable
 * tsconfig (compilerOptions-only) for virtual TypeScript environments.
 *
 * @remarks
 * Converts TypeScript's internal enum representation back to portable JSON
 * suitable for tooling that needs type information without emitting files:
 *
 * - Converts enum values (target, module, moduleResolution, jsx, etc.) to strings.
 * - Converts lib references from full paths (`lib.esnext.d.ts`) to short names (`esnext`).
 * - Forces `composite: false` and `noEmit: true`.
 * - Excludes path-dependent options (rootDir, outDir, baseUrl, paths, typeRoots, types).
 * - Excludes emit-related options (declaration, sourceMap, etc.).
 * - Excludes file selection (include, exclude, files, references).
 * - Adds `$schema` for IDE support.
 *
 * @public
 */
export class TsconfigResolver {
	/** @internal */
	private static readonly SCRIPT_TARGET_MAP: ReadonlyMap<ScriptTarget, string> = new Map([
		[ScriptTarget.ES5, "es5"],
		[ScriptTarget.ES2015, "es2015"],
		[ScriptTarget.ES2016, "es2016"],
		[ScriptTarget.ES2017, "es2017"],
		[ScriptTarget.ES2018, "es2018"],
		[ScriptTarget.ES2019, "es2019"],
		[ScriptTarget.ES2020, "es2020"],
		[ScriptTarget.ES2021, "es2021"],
		[ScriptTarget.ES2022, "es2022"],
		[ScriptTarget.ES2023, "es2023"],
		[ScriptTarget.ES2024, "es2024"],
		[ScriptTarget.ES2025, "es2025"],
		[ScriptTarget.ESNext, "esnext"],
		[ScriptTarget.JSON, "json"],
	]);

	/** @internal */
	private static readonly MODULE_KIND_MAP: ReadonlyMap<ModuleKind | number, string> = new Map([
		[ModuleKind.CommonJS, "commonjs"],
		[ModuleKind.ES2015, "es2015"],
		[ModuleKind.ES2020, "es2020"],
		[ModuleKind.ES2022, "es2022"],
		[ModuleKind.ESNext, "esnext"],
		[ModuleKind.Node16, "node16"],
		[101, "node18"], // ModuleKind.Node18 (not exported in all TS versions)
		[102, "node20"], // ModuleKind.Node20 (not exported in all TS versions)
		[ModuleKind.NodeNext, "nodenext"],
		[ModuleKind.Preserve, "preserve"],
	]);

	/** @internal */
	private static readonly MODULE_RESOLUTION_MAP: ReadonlyMap<ModuleResolutionKind, string> = new Map([
		[ModuleResolutionKind.Node10, "node10"],
		[ModuleResolutionKind.Node16, "node16"],
		[ModuleResolutionKind.NodeNext, "nodenext"],
		[ModuleResolutionKind.Bundler, "bundler"],
	]);

	/** @internal */
	private static readonly JSX_EMIT_MAP: ReadonlyMap<JsxEmit, string> = new Map([
		[JsxEmit.None, "none"],
		[JsxEmit.Preserve, "preserve"],
		[JsxEmit.React, "react"],
		[JsxEmit.ReactNative, "react-native"],
		[JsxEmit.ReactJSX, "react-jsx"],
		[JsxEmit.ReactJSXDev, "react-jsxdev"],
	]);

	/** @internal */
	private static readonly MODULE_DETECTION_MAP: ReadonlyMap<ModuleDetectionKind, string> = new Map([
		[ModuleDetectionKind.Legacy, "legacy"],
		[ModuleDetectionKind.Auto, "auto"],
		[ModuleDetectionKind.Force, "force"],
	]);

	/** @internal */
	private static readonly NEW_LINE_MAP: ReadonlyMap<NewLineKind, string> = new Map([
		[NewLineKind.CarriageReturnLineFeed, "crlf"],
		[NewLineKind.LineFeed, "lf"],
	]);

	/** Converts a `ScriptTarget` enum value to its string form (e.g. `es2023`). */
	static convertScriptTarget(target: ScriptTarget | undefined): string | undefined {
		if (target === undefined) return undefined;
		const mapped = TsconfigResolver.SCRIPT_TARGET_MAP.get(target);
		if (mapped !== undefined) return mapped;
		return `es${target}`;
	}

	/** Converts a `ModuleKind` enum value to its string form (e.g. `nodenext`). */
	static convertModuleKind(module: ModuleKind | undefined): string | undefined {
		if (module === undefined) return undefined;
		const mapped = TsconfigResolver.MODULE_KIND_MAP.get(module);
		if (mapped !== undefined) return mapped;
		return String(module);
	}

	/** Converts a `ModuleResolutionKind` enum value to its string form (e.g. `nodenext`). */
	static convertModuleResolution(resolution: ModuleResolutionKind | undefined): string | undefined {
		if (resolution === undefined) return undefined;
		const mapped = TsconfigResolver.MODULE_RESOLUTION_MAP.get(resolution);
		if (mapped !== undefined) return mapped;
		return String(resolution);
	}

	/** Converts a `JsxEmit` enum value to its string form (e.g. `preserve`, `react-jsx`). */
	static convertJsxEmit(jsx: JsxEmit | undefined): string | undefined {
		if (jsx === undefined) return undefined;
		const mapped = TsconfigResolver.JSX_EMIT_MAP.get(jsx);
		if (mapped !== undefined) return mapped;
		return String(jsx);
	}

	/** Converts a `ModuleDetectionKind` enum value to its string form (e.g. `force`). */
	static convertModuleDetection(detection: ModuleDetectionKind | undefined): string | undefined {
		if (detection === undefined) return undefined;
		const mapped = TsconfigResolver.MODULE_DETECTION_MAP.get(detection);
		if (mapped !== undefined) return mapped;
		return String(detection);
	}

	/** Converts a `NewLineKind` enum value to its string form (`lf` or `crlf`). */
	static convertNewLine(newLine: NewLineKind | undefined): string | undefined {
		if (newLine === undefined) return undefined;
		const mapped = TsconfigResolver.NEW_LINE_MAP.get(newLine);
		if (mapped !== undefined) return mapped;
		return String(newLine);
	}

	/**
	 * Converts a lib reference to its canonical short name.
	 *
	 * @remarks
	 * `ParsedCommandLine` stores lib references as full paths like `lib.esnext.d.ts`
	 * or `/path/to/typescript/lib/lib.dom.d.ts`. This returns the short tsconfig form
	 * (`esnext`, `dom`).
	 */
	static convertLibReference(lib: string): string {
		const filename = lib.includes("/") || lib.includes("\\") ? (lib.split(/[\\/]/).pop() ?? lib) : lib;
		return filename.replace(/^lib\./, "").replace(/\.d\.ts$/, "");
	}

	/**
	 * Resolves a parsed TypeScript config to a portable, compilerOptions-only tsconfig.
	 */
	resolve(parsed: ParsedCommandLine): PortableTsconfig {
		const opts = parsed.options;
		const compilerOptions: ResolvedCompilerOptions = {};

		// Convert enum options.
		if (opts.target !== undefined) compilerOptions.target = TsconfigResolver.convertScriptTarget(opts.target);
		if (opts.module !== undefined) compilerOptions.module = TsconfigResolver.convertModuleKind(opts.module);
		if (opts.moduleResolution !== undefined) {
			compilerOptions.moduleResolution = TsconfigResolver.convertModuleResolution(opts.moduleResolution);
		}
		if (opts.moduleDetection !== undefined) {
			compilerOptions.moduleDetection = TsconfigResolver.convertModuleDetection(opts.moduleDetection);
		}
		if (opts.jsx !== undefined) compilerOptions.jsx = TsconfigResolver.convertJsxEmit(opts.jsx);
		if (opts.newLine !== undefined) compilerOptions.newLine = TsconfigResolver.convertNewLine(opts.newLine);

		// Convert lib array.
		if (opts.lib && opts.lib.length > 0) {
			compilerOptions.lib = opts.lib.map(TsconfigResolver.convertLibReference);
		}

		// Virtual environment settings (always set).
		compilerOptions.composite = false;
		compilerOptions.noEmit = true;

		// Copy preserved boolean options.
		for (const opt of PRESERVED_BOOLEAN_OPTIONS) {
			if (opts[opt] !== undefined) compilerOptions[opt] = opts[opt];
		}

		// Copy preserved string options.
		for (const opt of PRESERVED_STRING_OPTIONS) {
			if (opts[opt] !== undefined) compilerOptions[opt] = opts[opt];
		}

		return {
			$schema: TSCONFIG_SCHEMA_URL,
			compilerOptions,
		};
	}
}

/**
 * Resolves the package's effective compiler options (following `extends`) into a
 * portable, JSON-serializable tsconfig for the meta release bundle.
 *
 * @remarks
 * Resolves the package's own `<cwd>/tsconfig.json` (which extends the shared
 * `@savvy-web/bundler/ecma.json` base) via the TypeScript API so the result
 * carries the full effective options (target/module/strict/jsx/lib), then
 * converts them to a portable, compilerOptions-only shape with no absolute
 * paths or emit/file-selection options.
 *
 * When the package has no own `tsconfig.json` (e.g. a minimal test fixture),
 * falls back to `fallbackConfigPath` — the build's already-resolved dts tsconfig,
 * which always exists during a build. If neither is present, returns a minimal
 * portable config carrying only the virtual-environment flags.
 *
 * @param cwd - Absolute package root.
 * @param fallbackConfigPath - Optional resolved tsconfig to use when the package has no own one.
 * @returns The portable tsconfig object.
 *
 * @public
 */
export function resolvePortableTsconfig(cwd: string, fallbackConfigPath?: string): PortableTsconfig {
	const ownConfig = join(cwd, "tsconfig.json");
	const configPath = existsSync(ownConfig)
		? ownConfig
		: fallbackConfigPath !== undefined && existsSync(fallbackConfigPath)
			? fallbackConfigPath
			: undefined;
	if (configPath === undefined) {
		// No tsconfig to resolve from — emit a minimal portable config with just the virtual-env flags.
		return { $schema: TSCONFIG_SCHEMA_URL, compilerOptions: { composite: false, noEmit: true } };
	}
	const host: ParseConfigFileHost = {
		...sys,
		onUnRecoverableConfigFileDiagnostic: (diagnostic) => {
			const message = flattenDiagnosticMessageText(diagnostic.messageText, "\n");
			throw new Error(`Cannot resolve portable tsconfig at ${configPath}: ${message}`);
		},
	};
	const parsed = getParsedCommandLineOfConfigFile(configPath, {}, host);
	if (parsed === undefined) {
		throw new Error(`Failed to parse tsconfig at ${configPath}`);
	}
	return new TsconfigResolver().resolve(parsed);
}
