/**
 * Utilities for updating version fields in additional JSON files.
 *
 * @remarks
 * Implements the `versionFiles` feature of `\@savvy-web/changesets`, which
 * allows version numbers to be synchronized across arbitrary JSON files
 * (e.g., `tauri.conf.json`, `manifest.json`) during the changeset version
 * step.
 *
 * The flow is:
 * 1. Extract and validate `versionFiles` from a pre-parsed config
 * 2. Resolve glob patterns to absolute file paths
 * 3. Discover workspace packages to determine the correct version per file
 *    (using longest-prefix matching)
 * 4. Update JSONPath-specified fields in each matched file
 *
 * @see {@link jsonPathGet} and {@link jsonPathSet} for the JSONPath implementation
 *
 * @internal
 */

import { readFileSync, writeFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { Schema } from "effect";
import { globSync } from "tinyglobby";
// biome-ignore lint/suspicious/noDeprecatedImports: parses the deprecated top-level versionFiles array during the 0.9.0 cycle; removed when Phase 5 migrates this to ConfigInspector
import type { LegacyVersionFileConfig } from "../schemas/version-files.js";
// biome-ignore lint/suspicious/noDeprecatedImports: parses the deprecated top-level versionFiles array during the 0.9.0 cycle; removed when Phase 5 migrates this to ConfigInspector
import { LegacyVersionFilesSchema } from "../schemas/version-files.js";
import type { ResolvedPackageScope } from "../services/config-inspector.js";
import { jsonPathGet, jsonPathSet } from "./jsonpath.js";

/**
 * Result of a single version file update.
 *
 * @remarks
 * Captures the details of what was changed in a JSON file, including
 * the previous values for audit/logging purposes.
 *
 * @internal
 */
export interface VersionFileUpdate {
	/** Absolute path to the updated file. */
	filePath: string;
	/** JSONPath expressions that were updated. */
	jsonPaths: readonly string[];
	/** The version that was written. */
	version: string;
	/** Previous values found at those paths. */
	previousValues: unknown[];
}

/**
 * A discovered workspace package with its version.
 *
 * @remarks
 * Maps file paths to the correct version via longest-prefix matching in
 * {@link VersionFiles.resolveVersion}.
 *
 * @public
 */
export interface WorkspaceVersion {
	/** Package name. */
	name: string;
	/** Absolute path to the package directory. */
	path: string;
	/** Current version from package.json. */
	version: string;
}

/**
 * Static utility class for version file operations.
 *
 * @remarks
 * Orchestrates the full version file update workflow: reading config,
 * discovering workspace versions, resolving globs, and updating JSON
 * files at specified JSONPath locations. Designed to be called from
 * the CLI `version` command.
 *
 * Version resolution uses longest-prefix matching: for a file at
 * `/repo/packages/ui/tauri.conf.json`, if workspace `packages/ui`
 * has version `2.0.0`, that version is used rather than the root version.
 *
 * @example
 * ```typescript
 * import { VersionFiles } from "../utils/version-files.js";
 *
 * const configs = VersionFiles.extractVersionFiles(parsedConfig);
 * if (configs) {
 *   const updates = VersionFiles.processVersionFiles("/path/to/project", configs);
 *   for (const update of updates) {
 *     console.log(`Updated ${update.filePath} to ${update.version}`);
 *   }
 * }
 * ```
 *
 * @internal
 */
// biome-ignore lint/complexity/noStaticOnlyClass: Intentional pattern for TSDoc discoverability
export class VersionFiles {
	/**
	 * Extract and validate `versionFiles` from a pre-parsed changeset config object.
	 *
	 * @remarks
	 * Accepts a config object (already parsed from `.changeset/config.json`),
	 * extracts the `changelog` tuple's second element (options object), and
	 * validates the `versionFiles` key against `LegacyVersionFilesSchema`. Returns
	 * `undefined` if `changelog` is not a tuple, the `versionFiles` key is
	 * absent, or the array is empty. Schema validation errors are logged as
	 * warnings but do not throw.
	 *
	 * File reading and JSONC parsing are delegated to the caller
	 * (e.g., `ChangesetConfigReader` from `\@savvy-web/silk-effects`).
	 *
	 * @param config - Pre-parsed changeset config object
	 * @returns Parsed config array, or `undefined` if not configured
	 */
	static extractVersionFiles(config: {
		changelog?: string | false | readonly unknown[] | undefined;
	}): readonly LegacyVersionFileConfig[] | undefined {
		const { changelog } = config;

		// changelog is expected to be a tuple: [formatter, options]
		if (!Array.isArray(changelog) || changelog.length < 2) {
			return undefined;
		}

		const options = changelog[1] as Record<string, unknown>;
		if (!options || typeof options !== "object" || !("versionFiles" in options)) {
			return undefined;
		}

		// versionFiles key is present — schema errors are now worth reporting
		try {
			const decoded = Schema.decodeUnknownSync(LegacyVersionFilesSchema)(options.versionFiles);
			return decoded.length > 0 ? decoded : undefined;
		} catch (error) {
			console.warn(
				`[changesets] Invalid versionFiles configuration: ${error instanceof Error ? error.message : String(error)}`,
			);
			return undefined;
		}
	}

	/**
	 * Discover all workspace packages and their current versions.
	 *
	 * @remarks
	 * Accepts a pre-resolved list of workspace packages (e.g., from
	 * `WorkspaceDiscovery.listPackages()`). The root package is always
	 * included if not already present in the packages list.
	 * Deduplicates by absolute path and skips entries without a version.
	 *
	 * @param cwd - Project root directory
	 * @param packages - Pre-resolved workspace packages
	 * @returns Array of workspace packages with versions
	 */
	static discoverVersions(
		cwd: string,
		packages: ReadonlyArray<{ name: string; version: string; path: string }>,
	): WorkspaceVersion[] {
		const resolvedCwd = resolve(cwd);
		const results: WorkspaceVersion[] = [];
		const seen = new Set<string>();

		for (const pkg of packages) {
			if (seen.has(pkg.path) || !pkg.version) continue;
			seen.add(pkg.path);
			results.push({ name: pkg.name, path: pkg.path, version: pkg.version });
		}

		// Always include root if not already present
		if (!seen.has(resolvedCwd)) {
			const version = readPackageVersion(resolvedCwd);
			if (version) {
				let rootName = "root";
				try {
					const pkg = JSON.parse(readFileSync(join(resolvedCwd, "package.json"), "utf-8")) as {
						name?: string;
					};
					if (pkg.name) rootName = pkg.name;
				} catch {
					// Use default name
				}
				results.push({ name: rootName, path: resolvedCwd, version });
			}
		}

		return results;
	}

	/**
	 * Determine which workspace version applies to a given file path
	 * using longest-prefix matching.
	 *
	 * @remarks
	 * For each workspace, checks whether the file is contained within
	 * it (i.e., the relative path does not start with `..`). Among all
	 * matching workspaces, the one with the longest absolute path wins
	 * (most specific match). Falls back to `rootVersion` if no workspace
	 * contains the file.
	 *
	 * @param filePath - Absolute path to the file
	 * @param workspaces - Discovered workspace versions
	 * @param rootVersion - Fallback version from project root
	 * @returns The version string to use
	 */
	static resolveVersion(filePath: string, workspaces: WorkspaceVersion[], rootVersion: string): string {
		const resolved = resolve(filePath);
		let bestMatch: WorkspaceVersion | undefined;
		let bestLength = 0;

		for (const ws of workspaces) {
			const rel = relative(ws.path, resolved);
			// File is inside this workspace if the relative path doesn't start with ".."
			if (!rel.startsWith("..") && ws.path.length > bestLength) {
				bestMatch = ws;
				bestLength = ws.path.length;
			}
		}

		return bestMatch?.version ?? rootVersion;
	}

	/**
	 * Resolve glob patterns to absolute file paths.
	 *
	 * @remarks
	 * Uses `tinyglobby` to expand each config's glob pattern relative to
	 * `cwd`. The `node_modules` directory is always ignored. Returns
	 * tuples pairing each resolved absolute path with its originating config.
	 *
	 * @param configs - Version file configurations
	 * @param cwd - Project root directory
	 * @returns Array of `[filePath, config]` tuples
	 */
	static resolveGlobs(
		configs: readonly LegacyVersionFileConfig[],
		cwd: string,
	): Array<[string, LegacyVersionFileConfig]> {
		const results: Array<[string, LegacyVersionFileConfig]> = [];
		const resolvedCwd = resolve(cwd);

		for (const config of configs) {
			const matches = globSync(config.glob, {
				cwd: resolvedCwd,
				ignore: ["**/node_modules/**"],
			});

			for (const match of matches) {
				results.push([join(resolvedCwd, match), config]);
			}
		}

		return results;
	}

	/**
	 * Detect indentation from file content.
	 *
	 * @remarks
	 * Looks for the first line starting with whitespace followed by a
	 * double-quote (typical JSON property). Defaults to 2 spaces if
	 * no indentation pattern is found.
	 *
	 * @param content - Raw file content
	 * @returns Detected indent string (defaults to 2 spaces)
	 */
	static detectIndent(content: string): string {
		const match = content.match(/^(\s+)"/m);
		return match?.[1] ?? "  ";
	}

	/**
	 * Update JSON file at specified JSONPath locations.
	 *
	 * @remarks
	 * Reads the file, detects its indentation style and trailing newline
	 * preference, applies all JSONPath updates via {@link jsonPathSet},
	 * and writes the result back preserving the original formatting.
	 * Returns `undefined` if no JSONPath locations matched (no write occurs).
	 *
	 * @param filePath - Absolute path to the JSON file
	 * @param jsonPaths - JSONPath expressions to update
	 * @param version - New version string
	 * @returns Update result, or `undefined` if no changes were made
	 */
	static updateFile(filePath: string, jsonPaths: readonly string[], version: string): VersionFileUpdate | undefined {
		const content = readFileSync(filePath, "utf-8");
		const indent = VersionFiles.detectIndent(content);
		const trailingNewline = content.endsWith("\n");
		const obj = JSON.parse(content) as unknown;

		const previousValues = jsonPaths.flatMap((jp) => jsonPathGet(obj, jp));
		let totalUpdated = 0;

		for (const jp of jsonPaths) {
			totalUpdated += jsonPathSet(obj, jp, version);
		}

		if (totalUpdated === 0) {
			return undefined;
		}

		let output = JSON.stringify(obj, null, indent);
		if (trailingNewline) {
			output += "\n";
		}

		writeFileSync(filePath, output, "utf-8");

		return {
			filePath,
			jsonPaths,
			version,
			previousValues,
		};
	}

	/**
	 * Orchestrate the full version file update flow.
	 *
	 * @remarks
	 * Combines {@link VersionFiles.discoverVersions},
	 * {@link VersionFiles.resolveGlobs}, {@link VersionFiles.resolveVersion},
	 * and {@link VersionFiles.updateFile} into a single operation. In dry-run
	 * mode, files are read and JSONPaths are resolved but no writes occur.
	 *
	 * @param cwd - Project root directory
	 * @param configs - Validated version file configurations
	 * @param dryRun - If true, do not write files (default: `false`)
	 * @returns Array of update results
	 * @throws If any file cannot be read or parsed
	 */
	static processVersionFiles(
		cwd: string,
		configs: readonly LegacyVersionFileConfig[],
		dryRun = false,
		packages: ReadonlyArray<{ name: string; version: string; path: string }> = [],
	): VersionFileUpdate[] {
		const workspaces = VersionFiles.discoverVersions(cwd, packages);
		const rootVersion = workspaces.find((ws) => ws.path === resolve(cwd))?.version ?? "0.0.0";
		const resolved = VersionFiles.resolveGlobs(configs, cwd);
		const updates: VersionFileUpdate[] = [];

		for (const [filePath, config] of resolved) {
			const jsonPaths = config.paths ?? ["$.version"];
			const version = config.package
				? (workspaces.find((ws) => ws.name === config.package)?.version ?? rootVersion)
				: VersionFiles.resolveVersion(filePath, workspaces, rootVersion);

			try {
				if (dryRun) {
					const content = readFileSync(filePath, "utf-8");
					const obj = JSON.parse(content) as unknown;
					const previousValues = jsonPaths.flatMap((jp) => jsonPathGet(obj, jp));
					if (previousValues.length > 0) {
						updates.push({ filePath, jsonPaths, version, previousValues });
					}
				} else {
					const result = VersionFiles.updateFile(filePath, jsonPaths, version);
					if (result) {
						updates.push(result);
					}
				}
			} catch (error) {
				throw new Error(`Failed to update ${filePath}: ${error instanceof Error ? error.message : String(error)}`);
			}
		}

		return updates;
	}

	/**
	 * Apply version-file updates from the resolved (post-`ConfigInspector`)
	 * representation. Each {@link ResolvedPackageScope} already names the
	 * owning package and carries its current version plus the materialized
	 * file paths, so no glob expansion or path-prefix workspace resolution
	 * is needed here — the inspector has done that work.
	 *
	 * @remarks
	 * This is the 0.9.0 successor to {@link VersionFiles.processVersionFiles}.
	 * The old method stays in place to handle the deprecated top-level
	 * `versionFiles[]` shape (read by `cli/commands/init.ts` for its
	 * validation pass), and is removed alongside the legacy schema in
	 * 1.0.0.
	 *
	 * @param scopes - Per-package resolved scopes from {@link ConfigInspector.inspect}
	 * @param dryRun - When `true`, do not write files
	 * @returns Array of update results, one per file that actually had a
	 *   matching JSONPath
	 *
	 * @internal
	 */
	static processResolvedVersionFiles(scopes: ReadonlyArray<ResolvedPackageScope>, dryRun = false): VersionFileUpdate[] {
		const updates: VersionFileUpdate[] = [];

		for (const scope of scopes) {
			for (const vf of scope.versionFiles) {
				const jsonPaths = vf.paths.length > 0 ? vf.paths : ["$.version"];
				for (const filePath of vf.matchedFiles) {
					try {
						if (dryRun) {
							const content = readFileSync(filePath, "utf-8");
							const obj = JSON.parse(content) as unknown;
							const previousValues = jsonPaths.flatMap((jp) => jsonPathGet(obj, jp));
							if (previousValues.length > 0) {
								updates.push({ filePath, jsonPaths, version: scope.version, previousValues });
							}
						} else {
							const result = VersionFiles.updateFile(filePath, jsonPaths, scope.version);
							if (result) {
								updates.push(result);
							}
						}
					} catch (error) {
						throw new Error(`Failed to update ${filePath}: ${error instanceof Error ? error.message : String(error)}`);
					}
				}
			}
		}

		return updates;
	}
}

/**
 * Read the `version` field from a `package.json` in the given directory.
 *
 * @param dir - Absolute path to the directory containing `package.json`
 * @returns The version string, or `undefined` if the file is missing or has no `version` field
 *
 * @internal
 */
function readPackageVersion(dir: string): string | undefined {
	try {
		const pkg = JSON.parse(readFileSync(join(dir, "package.json"), "utf-8")) as {
			version?: string;
		};
		return pkg.version;
	} catch {
		return undefined;
	}
}
