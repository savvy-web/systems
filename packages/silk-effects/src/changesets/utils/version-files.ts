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
import { GlobPattern } from "@effected/glob";
import { Jsonc, JsoncEdit, JsoncFormattingOptions, JsoncModifier } from "@effected/jsonc";
import type { DescendError } from "@effected/walker";
import { descend } from "@effected/walker";
import type { FileSystem } from "effect";
import { Effect, Option, Path, Schema } from "effect";
// biome-ignore lint/suspicious/noDeprecatedImports: parses the deprecated top-level versionFiles array during the 0.9.0 cycle; removed when Phase 5 migrates this to ConfigInspector
import type { LegacyVersionFileConfig } from "../schemas/version-files.js";
// biome-ignore lint/suspicious/noDeprecatedImports: parses the deprecated top-level versionFiles array during the 0.9.0 cycle; removed when Phase 5 migrates this to ConfigInspector
import { LegacyVersionFilesSchema } from "../schemas/version-files.js";
import type { ResolvedPackageScope } from "../services/config-inspector.js";
import { jsonPathGet, jsonPathResolve, parseJsonPath } from "./jsonpath.js";

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
 * import { Effect } from "effect";
 * import { VersionFiles } from "../utils/version-files.js";
 *
 * const configs = VersionFiles.extractVersionFiles(parsedConfig);
 * if (configs) {
 *   const updates = yield* VersionFiles.processVersionFiles("/path/to/project", configs);
 *   for (const update of updates) {
 *     yield* Effect.log(`Updated ${update.filePath} to ${update.version}`);
 *   }
 * }
 * ```
 *
 * @internal
 */

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
	 * Compiles each config's glob with `@effected/glob` and expands it against
	 * a filesystem walk rooted at `cwd` via `@effected/walker`'s `descend`
	 * (literal patterns fast-path a direct stat; magic patterns walk from
	 * their literal prefix). The `node_modules` and `.git` directories are
	 * always ignored. Returns tuples pairing each resolved absolute path with
	 * its originating config, per-glob results sorted by relative path.
	 *
	 * @param configs - Version file configurations
	 * @param cwd - Project root directory
	 * @returns Effect of `[filePath, config]` tuples
	 */
	static resolveGlobs(
		configs: readonly LegacyVersionFileConfig[],
		cwd: string,
	): Effect.Effect<Array<[string, LegacyVersionFileConfig]>, DescendError, FileSystem.FileSystem> {
		return Effect.gen(function* () {
			const results: Array<[string, LegacyVersionFileConfig]> = [];
			const resolvedCwd = resolve(cwd);

			for (const config of configs) {
				for (const match of yield* expandGlob(config.glob, resolvedCwd)) {
					results.push([join(resolvedCwd, match), config]);
				}
			}

			return results;
		});
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
	 * Update a JSON (or JSONC) file at specified JSONPath locations,
	 * preserving the original formatting byte-for-byte.
	 *
	 * @remarks
	 * The write is performed with `jsonc-effect`'s format-preserving
	 * `modify`/`applyEdits` rather than a `JSON.parse`/`JSON.stringify`
	 * round-trip (which always explodes inline arrays one-element-per-line and
	 * drops comments). Each JSONPath expression is resolved to concrete
	 * `(string | number)[]` paths against the parsed document, and each
	 * concrete path becomes a minimal text edit that touches only the target
	 * value's span — so inline arrays, comments,
	 * indentation, and the trailing-newline preference all survive; a one-line
	 * version bump produces a one-line diff.
	 *
	 * Insertion semantics: a concrete, wildcard-free JSONPath whose leaf
	 * property does not exist yet is inserted after the last sibling using the
	 * document's detected indent (the one case where indent detection still
	 * matters). Wildcard expressions only ever update existing matches. Returns
	 * `undefined` (no write) when nothing was updated or inserted.
	 *
	 * @param filePath - Absolute path to the JSON file
	 * @param jsonPaths - JSONPath expressions to update
	 * @param version - New version string
	 * @returns Update result, or `undefined` if no changes were made
	 *
	 * @see {@link jsonPathResolve} for concrete-path enumeration
	 * @see {@link VersionFiles.applyVersionEdit} for the per-path edit
	 */
	static updateFile(filePath: string, jsonPaths: readonly string[], version: string): VersionFileUpdate | undefined {
		const original = readFileSync(filePath, "utf-8");
		const { content, previousValues, totalChanged } = VersionFiles.computeUpdate(original, jsonPaths, version);

		if (totalChanged === 0) {
			return undefined;
		}

		writeFileSync(filePath, content, "utf-8");

		return {
			filePath,
			jsonPaths,
			version,
			previousValues,
		};
	}

	/**
	 * Compute the full update for a document without touching the filesystem:
	 * the edited content, the previous values at every matched path, and how
	 * many locations actually changed.
	 *
	 * @remarks
	 * This is the single decision path shared by {@link VersionFiles.updateFile}
	 * and the dry-run branches of the two process methods, so a preview reports
	 * exactly the files a real run would write — including pending inserts of a
	 * not-yet-existing wildcard-free leaf, and excluding same-value no-ops.
	 *
	 * @param original - Document text as read from disk
	 * @param jsonPaths - JSONPath expressions to update
	 * @param version - New version string
	 * @returns The updated content, previous values, and changed-location count
	 */
	private static computeUpdate(
		original: string,
		jsonPaths: readonly string[],
		version: string,
	): { content: string; previousValues: unknown[]; totalChanged: number } {
		let content = original;
		const obj = Effect.runSync(Jsonc.parse(content));

		const previousValues = jsonPaths.flatMap((jp) => jsonPathGet(obj, jp));

		// detectIndent + EOL are only consulted when a not-yet-existing property is
		// inserted; existing values are edited in place and inherit their own layout.
		const indent = VersionFiles.detectIndent(content);
		const eol = content.includes("\r\n") ? "\r\n" : "\n";

		let totalChanged = 0;

		for (const jp of jsonPaths) {
			const segments = parseJsonPath(jp);
			if (segments.length === 0) {
				continue;
			}

			const hasWildcard = segments.some((segment) => segment.type === "wildcard");
			// Wildcard paths only match what exists. Wildcard-free paths are turned into a
			// single concrete path directly, so a not-yet-existing property can be inserted —
			// unless the leaf is a numeric index, where `modify` would append to the array
			// instead of leaving the file alone.
			let concretePaths: Array<Array<string | number>>;
			if (hasWildcard) {
				concretePaths = jsonPathResolve(obj, jp);
			} else {
				// hasWildcard is false here, so every segment is a property or index.
				const direct = segments.map((segment) =>
					segment.type === "property" ? segment.key : (segment as { index: number }).index,
				);
				const leafExists = jsonPathResolve(obj, jp).length > 0;
				concretePaths = leafExists || typeof direct[direct.length - 1] === "string" ? [direct] : [];
			}

			for (const concretePath of concretePaths) {
				const updated = VersionFiles.applyVersionEdit(content, concretePath, version, indent, eol);
				if (updated !== undefined) {
					content = updated;
					totalChanged += 1;
				}
			}
		}

		return { content, previousValues, totalChanged };
	}

	/**
	 * Compute the format-preserving edit for a single concrete path, returning
	 * the updated document, or `undefined` when nothing changed.
	 *
	 * @remarks
	 * Delegates to `@effected/jsonc`'s `JsoncModifier.modify` +
	 * `JsoncEdit.applyAll` (whose edit spans touch only the target value), so
	 * every other byte of the document is preserved. When the leaf
	 * of a wildcard-free path does not exist, `modify` inserts the property
	 * after the last sibling using the supplied formatting options — the only
	 * case where the detected indent matters. A path whose parent is missing or
	 * not an object cannot be navigated; the resulting modification error is
	 * caught and reported as "no change" so the file is left alone.
	 *
	 * @param content - Current document text
	 * @param concretePath - A wildcard-free `(string | number)[]` path
	 * @param version - New version string
	 * @param indentUnit - One indentation level, for inserted text
	 * @param eol - End-of-line sequence, for inserted text
	 * @returns The updated document, or `undefined` if the path was unchanged
	 */
	private static applyVersionEdit(
		content: string,
		concretePath: ReadonlyArray<string | number>,
		version: string,
		indentUnit: string,
		eol: string,
	): string | undefined {
		const insertSpaces = !indentUnit.includes("\t");
		const program = JsoncModifier.modify(content, [...concretePath], version, {
			formattingOptions: JsoncFormattingOptions.make({
				insertSpaces,
				tabSize: insertSpaces ? indentUnit.length : 1,
				eol,
			}),
		}).pipe(
			Effect.map((edits) => JsoncEdit.applyAll(content, edits)),
			// A same-value edit round-trips to the identical document; report no change.
			Effect.map((updated) => (updated === content ? undefined : updated)),
			Effect.catchTag("JsoncModificationError", () => Effect.succeed(undefined)),
		);
		return Effect.runSync(program);
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
	 * @returns Effect of update results; a file that cannot be read or parsed
	 *   is a defect (the legacy path treats it as a caller bug, as the
	 *   previous synchronous `throw` did)
	 */
	static processVersionFiles(
		cwd: string,
		configs: readonly LegacyVersionFileConfig[],
		dryRun = false,
		packages: ReadonlyArray<{ name: string; version: string; path: string }> = [],
	): Effect.Effect<VersionFileUpdate[], DescendError, FileSystem.FileSystem> {
		return Effect.gen(function* () {
			const workspaces = VersionFiles.discoverVersions(cwd, packages);
			const rootVersion = workspaces.find((ws) => ws.path === resolve(cwd))?.version ?? "0.0.0";
			const resolved = yield* VersionFiles.resolveGlobs(configs, cwd);
			const updates: VersionFileUpdate[] = [];

			for (const [filePath, config] of resolved) {
				const jsonPaths = config.paths ?? ["$.version"];
				const version = config.package
					? (workspaces.find((ws) => ws.name === config.package)?.version ?? rootVersion)
					: VersionFiles.resolveVersion(filePath, workspaces, rootVersion);

				try {
					if (dryRun) {
						// Same decision path as the real run (computeUpdate), minus the write, so
						// the preview reports pending inserts and skips same-value no-ops too.
						const content = readFileSync(filePath, "utf-8");
						const { previousValues, totalChanged } = VersionFiles.computeUpdate(content, jsonPaths, version);
						if (totalChanged > 0) {
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
		});
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
							// Same decision path as the real run (computeUpdate), minus the write, so
							// the preview reports pending inserts and skips same-value no-ops too.
							const content = readFileSync(filePath, "utf-8");
							const { previousValues, totalChanged } = VersionFiles.computeUpdate(content, jsonPaths, scope.version);
							if (totalChanged > 0) {
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
 * Expand a glob pattern against the filesystem, returning matching FILE paths
 * relative to `cwd` (POSIX separators), sorted by relative path.
 *
 * @remarks
 * The walk is `@effected/walker`'s `descend` (literal fast path,
 * `enumerationPrefix` bounding, `node_modules`/`.git` pruning), with
 * `onUnreadable: "skip"` preserving this module's silent-skip policy for
 * unreadable directories. Matching semantics are minimatch DEFAULTS via the
 * compiled pattern — notably, wildcards do not match dotfiles, same as the
 * previous `tinyglobby` defaults. An uncompilable pattern expands to no
 * matches. `descend`'s `Path` requirement is satisfied internally with the
 * core POSIX `Path.layer` — this module already speaks POSIX relative match
 * paths and node-bound absolute paths throughout.
 *
 * @param source - The glob pattern, repo-relative
 * @param cwd - Absolute directory the pattern is resolved against
 * @returns Effect of relative paths of matching files, sorted
 *
 * @internal
 */
function expandGlob(
	source: string,
	cwd: string,
): Effect.Effect<ReadonlyArray<string>, DescendError, FileSystem.FileSystem> {
	return Effect.option(GlobPattern.compile(source)).pipe(
		Effect.flatMap(
			Option.match({
				onNone: () => Effect.succeed<ReadonlyArray<string>>([]),
				onSome: (pattern) => descend(pattern, { cwd, onUnreadable: "skip" }),
			}),
		),
		Effect.provide(Path.layer),
	);
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
