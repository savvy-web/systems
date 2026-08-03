/* v8 ignore start - build service requires actual bundling for integration testing */
/**
 * BuildService - Effect service for building GitHub Actions.
 *
 * @remarks
 * Provides bundling and build orchestration capabilities
 * using Effect's service pattern with Context.Service.
 *
 * @internal
 */
import { existsSync, mkdirSync, readFileSync, rmSync, statSync, unlinkSync, writeFileSync } from "node:fs";
import { basename, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createRsbuild } from "@rsbuild/core";
import { Context, Effect, Layer, Result, Schema } from "effect";

import type { BuildError, MainEntryMissing, WorkerEntryInvalidName, WorkerEntryMissing } from "../errors.js";
import { BundleFailed, CleanError, WriteError } from "../errors.js";
import type { Config } from "../schemas/config.js";
import { OptionalPathLikeSchema } from "../schemas/path.js";
import type { DetectedEntry } from "./config.js";
import { ConfigService } from "./config.js";
import { buildNativeDynamicImportRules } from "./native-dynamic-imports.js";

// =============================================================================
// Schemas
// =============================================================================

/**
 * Options for the build process.
 * @public
 */
export const BuildRunnerOptionsSchema = Schema.Struct({
	/** Working directory for the build. Accepts string, Buffer, or URL. */
	cwd: OptionalPathLikeSchema,
	/** Clean output directory before building. Defaults to true. */
	clean: Schema.optional(Schema.Boolean),
});

/**
 * Options for the build process.
 * @public
 */
export type BuildRunnerOptions = typeof BuildRunnerOptionsSchema.Type;

/**
 * Statistics for a single bundled entry.
 * @public
 */
export const BundleStatsSchema = Schema.Struct({
	/** Entry type (main, pre, or post). */
	entry: Schema.String,
	/** Bundle size in bytes. */
	size: Schema.Number,
	/** Build duration in milliseconds. */
	duration: Schema.Number,
	/** Output path relative to working directory. */
	outputPath: Schema.String,
});

/**
 * Statistics for a single bundled entry.
 * @public
 */
export type BundleStats = typeof BundleStatsSchema.Type;

/**
 * Result of bundling a single entry.
 * @public
 */
export const BundleResultSchema = Schema.Struct({
	/** Whether bundling succeeded. */
	success: Schema.Boolean,
	/** Bundle statistics if successful. */
	stats: Schema.optional(BundleStatsSchema),
	/** Error message if failed. */
	error: Schema.optional(Schema.String),
});

/**
 * Result of bundling a single entry.
 * @public
 */
export type BundleResult = typeof BundleResultSchema.Type;

/**
 * Result of the complete build process.
 * @public
 */
export const BuildResultSchema = Schema.Struct({
	/** Whether the overall build succeeded. */
	success: Schema.Boolean,
	/** Results for each entry that was built. */
	entries: Schema.Array(BundleResultSchema),
	/** Total build duration in milliseconds. */
	duration: Schema.Number,
	/** Error message if build failed. */
	error: Schema.optional(Schema.String),
});

/**
 * Result of the complete build process.
 * @public
 */
export type BuildResult = typeof BuildResultSchema.Type;

// =============================================================================
// Formatting Helpers
// =============================================================================

/**
 * Format bytes as a human-readable string.
 */
function formatBytes(bytes: number): string {
	if (bytes < 1024) {
		return `${bytes} B`;
	}
	if (bytes < 1024 * 1024) {
		return `${(bytes / 1024).toFixed(1)} KB`;
	}
	return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Format build result for terminal output.
 */
/* v8 ignore start - formatting function tested via integration */
function formatBuildResult(result: BuildResult): string {
	const lines: string[] = [];

	if (result.success) {
		lines.push("Build Summary:");
		for (const entry of result.entries) {
			if (entry.success && entry.stats) {
				const { entry: name, size, duration, outputPath } = entry.stats;
				lines.push(`  ✓ ${name}: ${formatBytes(size)} (${duration}ms) → ${outputPath}`);
			}
		}
		lines.push(`\nTotal time: ${result.duration}ms`);
	} else {
		lines.push("Build Failed:");
		for (const entry of result.entries) {
			if (!entry.success) {
				lines.push(`  ✗ ${entry.error}`);
			}
		}
	}

	return lines.join("\n");
}
/* v8 ignore stop */

// =============================================================================
// Build Helpers
// =============================================================================

/**
 * Source of the stub module that replaces packages listed in `build.ignore`.
 * It is bundled in place of the real module and throws if ever loaded.
 */
const IGNORE_STUB_SOURCE = `throw new Error("A module excluded via the build 'ignore' option was loaded at runtime.");\n`;

/**
 * Self-referencing specifier for the `webpackIgnore`-injecting loader
 * shipped from `public/loaders/webpack-ignore-dynamic-imports.cjs` (see
 * `package.json` `exports`). Resolved through the package's own `exports`
 * map via `import.meta.resolve`, which stays correct whether this module is
 * running from `src` (the map points at `./public/loaders/...`) or from a
 * built `dist` (the map points at the flattened `./loaders/...`, since the
 * `public/` copy step drops the `public/` prefix both on disk and in the
 * built manifest) — no relative-path assumption needed either way.
 */
const WEBPACK_IGNORE_LOADER_SPECIFIER = "@savvy-web/github-action-builder/loaders/webpack-ignore-dynamic-imports.cjs";

/**
 * Resolve the absolute on-disk path to the `webpackIgnore`-injecting loader.
 */
function resolveWebpackIgnoreLoaderPath(): string {
	return fileURLToPath(import.meta.resolve(WEBPACK_IGNORE_LOADER_SPECIFIER));
}

/**
 * Clean output directory.
 */
function cleanDirectory(dir: string): Effect.Effect<void, CleanError> {
	return Effect.try({
		try: () => {
			if (existsSync(dir)) {
				rmSync(dir, { recursive: true, force: true });
			}
		},
		/* v8 ignore next 5 - error branch requires fs permission failures */
		catch: (error) =>
			new CleanError({
				directory: dir,
				cause: error,
			}),
	});
}

/**
 * Write file with directory creation.
 */
function writeFile(path: string, content: string): Effect.Effect<void, WriteError> {
	return Effect.try({
		try: () => {
			const dir = resolve(path, "..");
			mkdirSync(dir, { recursive: true });
			writeFileSync(path, content, "utf8");
		},
		/* v8 ignore next 5 - error branch requires fs permission failures */
		catch: (error) =>
			new WriteError({
				path,
				cause: error,
			}),
	});
}

/**
 * Fold an extracted `*.LICENSE.txt` sidecar back into its bundle.
 *
 * `legalComments: "linked"` is the only mode whose extraction actually sees
 * bundled license banners — the "inline" mode's SWC comment-preservation path
 * never receives them and silently drops attribution (verified against
 * rsbuild 2.1.8). A committed action still must not carry sidecar files
 * (issue #94), so the sidecar's verbatim comment blocks replace the
 * `LICENSE:` reference banner in the bundle and the sidecar is deleted —
 * attribution inline, no extra dist file.
 */
function inlineLicenseSidecar(outputPath: string): Effect.Effect<void, WriteError> {
	return Effect.try({
		try: () => {
			const sidecarPath = `${outputPath}.LICENSE.txt`;
			if (!existsSync(sidecarPath)) {
				return;
			}
			const licenses = readFileSync(sidecarPath, "utf8").trim();
			const bundle = readFileSync(outputPath, "utf8");
			// The reference banner rspack emits is a fixed literal, so plain string
			// operations replace it — no regex built from a filename (CodeQL #9).
			const reference = `/*! LICENSE: ${basename(sidecarPath)} */`;
			const afterReference =
				bundle.startsWith(reference) && bundle.charAt(reference.length) === "\n"
					? reference.length + 1
					: bundle.startsWith(reference)
						? reference.length
						: 0;
			const rest = bundle.slice(afterReference);
			const folded = `${licenses}\n${rest}`;
			writeFileSync(outputPath, folded, "utf8");
			unlinkSync(sidecarPath);
		},
		/* v8 ignore next 5 - error branch requires fs permission failures */
		catch: (error) =>
			new WriteError({
				path: outputPath,
				cause: error,
			}),
	});
}

/**
 * Bundle a single entry with rsbuild.
 */
/* v8 ignore start - bundling requires actual rsbuild execution */
function bundleEntry(
	entry: DetectedEntry,
	config: Config,
	cwd: string,
): Effect.Effect<BundleResult, BundleFailed | WriteError> {
	return Effect.gen(function* () {
		const startTime = Date.now();
		const outputDir = resolve(cwd, "dist");

		// Modules listed in `build.ignore` are aliased to a throwing stub so
		// they are neither bundled nor resolved against node_modules. See
		// docs/superpowers/specs/2026-05-15-build-ignore-option-design.md.
		const externalsSet = new Set(config.build.externals);
		const ignoreSet = new Set(config.build.ignore);
		const ignoreAlias: Record<string, string> = {};

		// Packages listed in `build.nativeDynamicImports` resolve a module path
		// at runtime and dynamically import it (e.g. @changesets/apply-release-plan
		// resolving a changelog module). rspack cannot statically analyze a fully
		// dynamic import(expr) and compiles it into a context module that throws
		// "Cannot find module" at runtime even though the file exists on disk. The
		// webpackIgnore-injecting loader below leaves those calls as native
		// import() so they resolve for real at runtime.
		const nativeDynamicImportRules =
			config.build.nativeDynamicImports.length > 0
				? buildNativeDynamicImportRules(config.build.nativeDynamicImports, resolveWebpackIgnoreLoaderPath())
				: [];
		if (config.build.ignore.length > 0) {
			// rspack embeds the stub's path verbatim as the ignored modules' module
			// id, so the path must be deterministic — a per-build `mkdtemp` directory
			// made the committed bundle change on every run (#94). This cache path is
			// project-local (under node_modules, not a world-writable shared tmp), so
			// a fixed name keeps the symlink-safety property the original design (#81)
			// relied on while making the output reproducible.
			const stubPath = resolve(cwd, "node_modules", ".cache", "github-action-builder", "ignore-stub.mjs");
			yield* writeFile(stubPath, IGNORE_STUB_SOURCE);
			for (const moduleName of config.build.ignore) {
				ignoreAlias[`${moduleName}$`] = stubPath;
			}
		}

		// createRsbuild returns a Promise<RsbuildInstance>
		const rsbuild = yield* Effect.tryPromise({
			try: () =>
				createRsbuild({
					rsbuildConfig: {
						// Via the JS API, rsbuild's mode resolves from NODE_ENV and falls
						// back to "none" when it is unset — and minification only applies
						// in "production" mode, so a bare local build silently emitted an
						// unminified 7x dist while CI (NODE_ENV=production) minified. This
						// tool only produces committed production artifacts; pin the mode
						// so build.minify alone decides minification.
						mode: "production",
						source: { entry: { [entry.type]: entry.path } },
						resolve: { alias: ignoreAlias },
						output: {
							target: "node",
							module: true,
							distPath: { root: outputDir },
							filename: { js: "[name].js" },
							// A single function makes the whole externalization decision so
							// it never depends on rspack's array fall-through. Leading the
							// array with a function caused rspack to stop consulting trailing
							// string entries, so user-configured externals were bundled and
							// hard-failed to resolve instead of being externalized (#81).
							externals: (data: { request?: string }): string | false => {
								const request = data.request;
								if (!request) {
									return false;
								}
								// node: builtins are externalized with CommonJS require()
								// semantics. Output is ESM (output.module), so the default
								// "module" type makes require("node:*") inside bundled CJS deps
								// return an ESM namespace object. That breaks the TypeScript
								// __importDefault interop helper and throws "instanceof is not
								// callable" at runtime. "node-commonjs" preserves real
								// require() semantics. See issue #79.
								if (request.startsWith("node:")) {
									return `node-commonjs ${request}`;
								}
								// User-configured externals: not bundled, left as runtime
								// imports with the default external type.
								// `ignore` takes precedence over `externals`: a module in
								// both lists is stubbed via resolve.alias, not externalized.
								if (externalsSet.has(request) && !ignoreSet.has(request)) {
									return request;
								}
								return false;
							},
							cleanDistPath: false,
							// "linked" is the only legalComments mode whose extraction sees
							// bundled license banners under real minification — "inline" relies
							// on the SWC minimizer's comment preservation, which never receives
							// the module banners and silently drops attribution (rsbuild 2.1.8;
							// surfaced when mode: "production" made minification real). The
							// sidecar it emits is folded back into the bundle and deleted by
							// inlineLicenseSidecar, preserving the no-sidecar contract (#94).
							legalComments: "linked",
							minify: config.build.minify,
							sourceMap: config.build.sourceMap ? { js: "source-map" as const } : false,
						},
						performance: {
							chunkSplit: { strategy: "all-in-one" },
						},
						tools: {
							// Output is ESM (`output.module`). CommonJS dependencies that
							// reference the module globals `__dirname` / `__filename` — e.g.
							// `@cyclonedx/cyclonedx-library` — throw "__dirname is not defined"
							// once bundled, because ESM has no such globals. `"node-module"`
							// makes rspack derive them from `import.meta.url`.
							rspack: {
								node: { __dirname: "node-module", __filename: "node-module" },
								// Leave `import.meta.url` as a runtime expression. rspack's
								// default `import.meta` parsing freezes each module's
								// `import.meta.url` to its absolute *source* path as a `file://`
								// literal during scope hoisting — e.g. `@azure/storage-common`'s
								// crc64 ESM-compat shim calls `createRequire(import.meta.url)` /
								// `fileURLToPath(import.meta.url)` at module top-level. That baked
								// build-machine path is a structurally valid POSIX file-URL on
								// macOS/Linux (so `createRequire` accepts it and the library's
								// native-addon load fails over to its JS fallback), but `createRequire`
								// rejects a POSIX file-URL on Windows and throws at module load,
								// before any fallback — crashing the action. Disabling the parse
								// leaves `import.meta.url` resolving to the emitted ESM bundle's own
								// URL at runtime on every platform. See silk-runtime-action#137.
								module: {
									parser: { javascript: { importMeta: false } },
									// One rule per `build.nativeDynamicImports` package name; each
									// routes that package's bundled source through the
									// webpackIgnore-injecting loader (empty when the option is unset).
									rules: nativeDynamicImportRules,
								},
								// A committed GitHub Action is cleaner as one file per entry.
								// `asyncChunks: false` folds dynamically-imported code into the
								// parent chunk, so a dynamic `import()` in the source no longer
								// emits a separate `<id>.js` chunk — the build produces just
								// `main.js` / `pre.js` / `post.js`. Tree-shaking is unaffected.
								output: { asyncChunks: false },
							},
						},
					},
				}),
			catch: (error) =>
				new BundleFailed({
					entry: entry.path,
					cause: error,
				}),
		});

		const buildResult = yield* Effect.tryPromise({
			try: () => rsbuild.build(),
			catch: (error) =>
				new BundleFailed({
					entry: entry.path,
					cause: error,
				}),
		});

		// Release rsbuild resources (file watchers, worker threads)
		yield* Effect.tryPromise({
			try: () => buildResult.close(),
			catch: (error) =>
				new BundleFailed({
					entry: entry.path,
					cause: new Error(`rsbuild close() failed: ${error}`),
				}),
		});

		const outputPath = resolve(outputDir, `${entry.type}.js`);
		yield* inlineLicenseSidecar(outputPath);
		const size = yield* Effect.try({
			try: () => statSync(outputPath).size,
			catch: (error) =>
				new BundleFailed({
					entry: entry.path,
					cause: error,
				}),
		});
		const duration = Date.now() - startTime;

		return {
			success: true,
			stats: {
				entry: entry.type,
				size,
				duration,
				outputPath: entry.output,
			},
		};
	});
}
/* v8 ignore stop */

// =============================================================================
// Service Definition
// =============================================================================

/**
 * Service shape for build and bundling capabilities.
 *
 * @remarks
 * This service handles:
 * - Bundling TypeScript entries with rsbuild
 * - Managing output directory
 * - Collecting build statistics
 * - Formatting build results
 *
 * Use this interface to type structural implementations (e.g. test mocks);
 * use the {@link BuildService} class as the service key.
 *
 * @public
 */
export interface BuildServiceShape {
	/**
	 * Build all entries from the configuration.
	 *
	 * @param config - Configuration with entry points
	 * @param options - Build options
	 * @returns Effect that resolves to build result
	 */
	readonly build: (
		config: Config,
		options?: BuildRunnerOptions,
	) => Effect.Effect<BuildResult, BuildError | MainEntryMissing | WorkerEntryMissing | WorkerEntryInvalidName>;

	/**
	 * Bundle a single entry point.
	 *
	 * @param entry - Entry to bundle
	 * @param config - Build configuration
	 * @returns Effect that resolves to bundle result
	 */
	readonly bundle: (entry: DetectedEntry, config: Config) => Effect.Effect<BundleResult, BuildError>;

	/**
	 * Clean the output directory.
	 *
	 * @param outputDir - Directory to clean
	 * @returns Effect that resolves when complete
	 */
	readonly clean: (outputDir: string) => Effect.Effect<void, BuildError>;

	/**
	 * Format build result for display.
	 *
	 * @param result - Build result to format
	 * @returns Formatted string for terminal output
	 */
	readonly formatResult: (result: BuildResult) => string;

	/**
	 * Format bytes as human-readable string.
	 *
	 * @param bytes - Number of bytes
	 * @returns Formatted string like "1.5 MB"
	 */
	readonly formatBytes: (bytes: number) => string;
}

/**
 * BuildService key for dependency injection.
 *
 * @example Using BuildService with Effect
 * ```typescript
 * import { Effect } from "effect";
 * import { AppLayer, BuildService, ConfigService } from "@savvy-web/github-action-builder";
 *
 * const program = Effect.gen(function* () {
 *   const configService = yield* ConfigService;
 *   const buildService = yield* BuildService;
 *
 *   const { config } = yield* configService.load();
 *   const result = yield* buildService.build(config);
 *
 *   if (result.success) {
 *     console.log("Build complete:", result.entries.length, "entries");
 *   }
 * });
 *
 * Effect.runPromise(program.pipe(Effect.provide(AppLayer)));
 * ```
 *
 * @public
 */
export class BuildService extends Context.Service<BuildService, BuildServiceShape>()("BuildService") {
	/**
	 * Production implementation of {@link BuildService}.
	 *
	 * @remarks
	 * Uses rsbuild for bundling. Depends on {@link ConfigService}.
	 *
	 * @public
	 */
	static readonly layer: Layer.Layer<BuildService, never, ConfigService> = Layer.effect(
		this,
		Effect.gen(function* () {
			const configService = yield* ConfigService;

			return {
				/* v8 ignore start - build execution requires actual rsbuild bundling */
				build: (config: Config, options: BuildRunnerOptions = {}) =>
					Effect.gen(function* () {
						const cwd = options.cwd ?? process.cwd();
						const shouldClean = options.clean ?? true;
						const startTime = Date.now();

						// Detect entries
						const entriesConfig: { main?: string; pre?: string; post?: string; workers?: Record<string, string> } = {
							main: config.entries.main,
						};
						if (config.entries.pre) entriesConfig.pre = config.entries.pre;
						if (config.entries.post) entriesConfig.post = config.entries.post;
						if (config.entries.workers) entriesConfig.workers = config.entries.workers;
						const entriesResult = yield* configService.detectEntries(cwd, entriesConfig);

						// Clean output directory if requested
						if (shouldClean) {
							yield* cleanDirectory(resolve(cwd, "dist"));
						}

						// Build each entry
						const entryResults: BundleResult[] = [];
						for (const entry of entriesResult.entries) {
							const result = yield* Effect.result(bundleEntry(entry, config, cwd));
							if (Result.isFailure(result)) {
								const err = result.failure;
								entryResults.push({
									success: false,
									error: err.cause instanceof Error ? err.cause.message : String(err.cause),
								});
							} else {
								entryResults.push(result.success);
							}
						}

						// Create dist/package.json for ESM compatibility
						yield* writeFile(resolve(cwd, "dist/package.json"), '{ "type": "module" }');

						const duration = Date.now() - startTime;
						const success = entryResults.every((r) => r.success);

						if (!success) {
							return {
								success,
								entries: entryResults,
								duration,
								error: "One or more entries failed to build",
							};
						}
						return {
							success,
							entries: entryResults,
							duration,
						};
					}),
				/* v8 ignore stop */

				bundle: (entry: DetectedEntry, config: Config) => bundleEntry(entry, config, process.cwd()),

				clean: (outputDir: string) => cleanDirectory(outputDir),

				formatResult: formatBuildResult,

				formatBytes,
			};
		}),
	);
}
/* v8 ignore stop */
