/* v8 ignore start - build service requires actual bundling for integration testing */
/**
 * BuildService Layer implementation.
 *
 */
import { existsSync, mkdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createRsbuild } from "@rsbuild/core";
import { Effect, Layer, Result } from "effect";

import { BundleFailed, CleanError, WriteError } from "../errors.js";
import type { Config } from "../schemas/config.js";
import type { BuildResult, BuildRunnerOptions, BundleResult } from "./build.js";
import { BuildService } from "./build.js";
import type { DetectedEntry } from "./config.js";
import { ConfigService } from "./config.js";
import { buildNativeDynamicImportRules } from "./native-dynamic-imports.js";

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

// =============================================================================
// Formatting Helpers
// =============================================================================

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
							// Keep third-party license banners inline instead of extracting them
							// to `*.LICENSE.txt` sidecars (rspack's "linked" behavior), which are
							// committed-action noise — while still preserving attribution (#94).
							legalComments: "inline",
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
// Layer Implementation
// =============================================================================

/**
 * Live implementation of BuildService.
 *
 * @remarks
 * Uses rsbuild for bundling.
 */
export const BuildServiceLive = Layer.effect(
	BuildService,
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
/* v8 ignore stop */
