/**
 * `ConfigInspector` service — surface the project's `.changeset/config.json`
 * in a structured, validated form that agents and tooling can consume.
 *
 * @remarks
 * The inspector handles three responsibilities that the schemas alone cannot:
 *
 * 1. **Legacy normalization.** Configs from 0.8.x still use the flat
 *    top-level `versionFiles[]` array. When that field is populated, the
 *    inspector emits a one-line deprecation warning to stderr (naming the
 *    config path and the required edit) and folds each legacy entry into
 *    the equivalent `packages[entry.package].versionFiles` shape for
 *    downstream consumers. Removed in 1.0.0.
 * 2. **Resolution against the workspace.** Each `packages` key must resolve
 *    to a known workspace package via `WorkspaceDiscovery`. Unknown keys
 *    surface as a {@link ConfigurationError}. The inspector returns the
 *    package's absolute workspace directory alongside the resolved scope.
 * 3. **Overlap detection.** Cross-package validation rules that the schemas
 *    cannot enforce:
 *    - `additionalScopes` of two different packages must not overlap.
 *    - `additionalScopes` of one package must not shadow another package's
 *      workspace directory.
 *    - Two `versionFiles` entries (within or across packages) must not
 *      resolve to the same `(file, $.path)` tuple.
 *
 * Validation is performed eagerly on the first {@link ConfigInspectorShape.inspect}
 * call. The resolved state is cached internally per `cwd` so subsequent
 * {@link ConfigInspectorShape.classify} calls reuse it.
 *
 * @see {@link ConfigInspector} for the Effect service tag
 * @see {@link ConfigInspectorLive} for the production layer
 *
 * @packageDocumentation
 */

import { isAbsolute, join, relative, resolve } from "node:path";
import { FileSystem } from "@effect/platform";
import { Context, Effect, Layer, Schema } from "effect";
import { globSync } from "tinyglobby";
import { WorkspaceDiscovery } from "workspaces-effect";
import { ChangesetConfigReader } from "../../services/ChangesetConfigReader.js";
import type { RawPackageJson } from "../../services/SilkPublishability.js";
import { SilkPublishability, readTargetsBinding } from "../../services/SilkPublishability.js";

import { ConfigurationError } from "../errors.js";
import { ChangesetOptionsSchema } from "../schemas/options.js";
import type { VersionFileConfig } from "../schemas/version-files.js";

/** A `versionFiles` entry expanded to its absolute target paths. @public */
export const ResolvedVersionFileSchema = Schema.Struct({
	glob: Schema.String,
	paths: Schema.Array(Schema.String).annotations({
		description: 'JSONPath expressions to update (defaults to ["$.version"]).',
	}),
	matchedFiles: Schema.Array(Schema.String),
}).annotations({ identifier: "ResolvedVersionFile" });
/** A `versionFiles` entry expanded to its absolute target paths. @public */
export type ResolvedVersionFile = Schema.Schema.Type<typeof ResolvedVersionFileSchema>;

/** A package's resolved release surface. @public */
export const ResolvedPackageScopeSchema = Schema.Struct({
	name: Schema.String,
	workspaceDir: Schema.String,
	version: Schema.String,
	additionalScopes: Schema.Array(Schema.String),
	additionalScopeFiles: Schema.Array(Schema.String),
	versionFiles: Schema.Array(ResolvedVersionFileSchema),
}).annotations({ identifier: "ResolvedPackageScope" });
/** A package's resolved release surface. @public */
export type ResolvedPackageScope = Schema.Schema.Type<typeof ResolvedPackageScopeSchema>;

/** Structured representation of a resolved `.changeset/config.json`. @public */
export const InspectedConfigSchema = Schema.Struct({
	configPath: Schema.String,
	projectDir: Schema.String.annotations({
		description: "Absolute project root (the directory containing .changeset/).",
	}),
	changelog: Schema.NullOr(Schema.String),
	baseBranch: Schema.String,
	access: Schema.Literal("public", "restricted"),
	ignore: Schema.Array(Schema.String),
	packages: Schema.Array(ResolvedPackageScopeSchema),
	legacyVersionFilesUsed: Schema.Boolean,
}).annotations({ identifier: "InspectedConfig" });
/** Structured representation of a resolved `.changeset/config.json`. @public */
export type InspectedConfig = Schema.Schema.Type<typeof InspectedConfigSchema>;

/** Reason a path was attributed to a package (or left unmapped). @public */
export const ClassificationReasonSchema = Schema.Union(
	Schema.Literal("workspace"),
	Schema.Struct({ kind: Schema.Literal("additionalScope"), glob: Schema.String }),
	Schema.Struct({ kind: Schema.Literal("versionFile"), glob: Schema.String }),
	Schema.Null,
).annotations({ identifier: "ClassificationReason" });
/** Reason a path was attributed to a package (or left unmapped). @public */
export type ClassificationReason = Schema.Schema.Type<typeof ClassificationReasonSchema>;

/** The result of classifying a single path against a resolved config. @public */
export const ClassificationSchema = Schema.Struct({
	path: Schema.String,
	package: Schema.NullOr(Schema.String),
	reason: ClassificationReasonSchema,
}).annotations({ identifier: "Classification" });
/** The result of classifying a single path against a resolved config. @public */
export type Classification = Schema.Schema.Type<typeof ClassificationSchema>;

/**
 * Effect service interface for inspecting a project's changeset config.
 *
 * @public
 */
export interface ConfigInspectorShape {
	/**
	 * Read, validate, and normalize `.changeset/config.json` in the given
	 * project directory.
	 *
	 * @param cwd - Absolute path to the project root (containing `.changeset/`)
	 * @returns An Effect that succeeds with {@link InspectedConfig} or fails
	 *   with {@link ConfigurationError}
	 */
	readonly inspect: (cwd: string) => Effect.Effect<InspectedConfig, ConfigurationError>;

	/**
	 * Classify each repo-relative path against the resolved config.
	 *
	 * @param cwd - Absolute path to the project root
	 * @param paths - Repo-relative file paths to classify
	 * @returns An Effect that succeeds with a {@link Classification} per
	 *   input path, in the same order
	 */
	readonly classify: (
		cwd: string,
		paths: ReadonlyArray<string>,
	) => Effect.Effect<ReadonlyArray<Classification>, ConfigurationError>;
}

const _tag = Context.Tag("ConfigInspector");

/**
 * Base class for {@link ConfigInspector}.
 *
 * @privateRemarks
 * Effect's `Context.Tag` creates an anonymous base class that api-extractor
 * cannot follow without an explicit export. Do not delete.
 *
 * @internal
 */
export const ConfigInspectorBase = _tag<ConfigInspector, ConfigInspectorShape>();

/**
 * Effect service tag for {@link ConfigInspectorShape}.
 *
 * @example
 * ```typescript
 * import { Effect } from "effect";
 * import { ConfigInspector, ConfigInspectorLive } from "@savvy-web/changesets";
 *
 * const program = Effect.gen(function* () {
 *   const inspector = yield* ConfigInspector;
 *   const config = yield* inspector.inspect(process.cwd());
 *   return config.packages.map((p) => p.name);
 * });
 *
 * Effect.runPromise(program.pipe(Effect.provide(ConfigInspectorLive)));
 * ```
 *
 * @public
 */
export class ConfigInspector extends ConfigInspectorBase {}

/* ----------------------------------------------------------------- *
 * Internal helpers
 * ----------------------------------------------------------------- */

interface OptionsBag {
	readonly changelogId: string | null;
	readonly options: unknown;
}

/**
 * Pull the changelog formatter ID and its options object out of the raw
 * `.changeset/config.json` shape (where `changelog` may be a tuple, a string,
 * or absent).
 */
function extractChangelogOptions(config: { changelog?: unknown }): OptionsBag {
	const { changelog } = config;
	if (Array.isArray(changelog)) {
		const id = typeof changelog[0] === "string" ? (changelog[0] as string) : null;
		const options = changelog[1] ?? {};
		return { changelogId: id, options };
	}
	if (typeof changelog === "string") {
		return { changelogId: changelog, options: {} };
	}
	return { changelogId: null, options: {} };
}

/**
 * Normalize the deprecated top-level `versionFiles[]` array into the
 * equivalent `packages[entry.package].versionFiles` shape. Mutates a fresh
 * copy of the options; never the input.
 *
 * Returns the normalized options and a flag indicating whether normalization
 * happened (so the caller can emit a deprecation warning once per inspect).
 */
function normalizeLegacyOptions(
	options: Record<string, unknown>,
	configPath: string,
): { readonly normalized: Record<string, unknown>; readonly legacyUsed: boolean } {
	const legacy = options.versionFiles;
	if (!Array.isArray(legacy) || legacy.length === 0) {
		return { normalized: options, legacyUsed: false };
	}

	// Emit the deprecation warning before we strip the field. Using
	// console.warn matches the convention already established in
	// utils/version-files.ts. One line, names the config path.
	console.warn(
		`[changesets] DEPRECATION: ${configPath} uses the top-level \`versionFiles\` array. ` +
			"Migrate to `changelog[1].packages[<name>].versionFiles`. Removed in 1.0.0.",
	);

	// Build (or extend) packages from the legacy entries. Entries without a
	// `package` field cannot be normalized into the new keyed shape — they
	// previously relied on path-based workspace resolution. Surface them as
	// an error rather than silently dropping.
	const existing = (options.packages as Record<string, unknown> | undefined) ?? {};
	const next: Record<string, Record<string, unknown>> = {};
	for (const [k, v] of Object.entries(existing)) {
		next[k] = { ...(v as Record<string, unknown>) };
	}

	for (const entry of legacy as ReadonlyArray<Record<string, unknown>>) {
		const ownerName = typeof entry.package === "string" ? entry.package : undefined;
		if (!ownerName) {
			throw new ConfigurationError({
				field: "versionFiles",
				reason:
					`Legacy versionFiles entry { glob: ${JSON.stringify(entry.glob)} } in ${configPath} ` +
					"has no `package` field. Path-based owner inference is removed during the 0.9.0 migration — " +
					"add an explicit `package` field, or migrate the entry to `packages[<name>].versionFiles`.",
			});
		}
		if (!next[ownerName]) next[ownerName] = {};
		const slot = next[ownerName];
		const arr = Array.isArray(slot.versionFiles) ? (slot.versionFiles as Array<Record<string, unknown>>).slice() : [];
		const cleaned: Record<string, unknown> = { glob: entry.glob };
		if (Array.isArray(entry.paths)) cleaned.paths = entry.paths;
		arr.push(cleaned);
		slot.versionFiles = arr;
	}

	const normalized = { ...options, packages: next };
	// Strip the deprecated field so the schema accepts the result.
	delete (normalized as Record<string, unknown>).versionFiles;
	return { normalized, legacyUsed: true };
}

/**
 * Materialize a glob against `cwd` and return the matched file paths as
 * repo-relative strings. Honors negation patterns and ignores `node_modules`.
 */
function materializeGlob(glob: string, cwd: string): ReadonlyArray<string> {
	return globSync(glob, {
		cwd,
		ignore: ["**/node_modules/**"],
		dot: true,
	});
}

/**
 * Determine whether `child` is the same directory as `parent` or sits inside
 * it. Both paths must be absolute.
 */
function isInside(parent: string, child: string): boolean {
	const rel = relative(parent, child);
	return rel === "" || (!rel.startsWith("..") && !isAbsolute(rel));
}

/**
 * Build per-package resolved scopes by intersecting the (possibly normalized)
 * options with workspace info.
 */
function buildResolvedScopes(params: {
	readonly options: Schema.Schema.Type<typeof ChangesetOptionsSchema>;
	readonly workspaces: ReadonlyArray<{ name: string; path: string; version: string }>;
	readonly projectDir: string;
	readonly configPath: string;
}): ReadonlyArray<ResolvedPackageScope> {
	const { options, workspaces, projectDir, configPath } = params;
	const packages = options.packages ?? {};
	const workspacesByName = new Map(workspaces.map((w) => [w.name, w] as const));

	const scopes: ResolvedPackageScope[] = [];
	for (const [pkgName, scope] of Object.entries(packages)) {
		const ws = workspacesByName.get(pkgName);
		if (!ws) {
			throw new ConfigurationError({
				field: `packages["${pkgName}"]`,
				reason:
					`Unknown package "${pkgName}" in ${configPath}. ` +
					`Known workspace packages: ${workspaces.map((w) => w.name).join(", ") || "(none)"}.`,
			});
		}

		const additionalScopes: ReadonlyArray<string> = scope.additionalScopes ?? [];
		const additionalScopeFiles = additionalScopes.flatMap((g) => materializeGlob(g, projectDir));
		const versionFileEntries = scope.versionFiles ?? ([] as ReadonlyArray<VersionFileConfig>);
		const resolvedVersionFiles: ResolvedVersionFile[] = versionFileEntries.map((entry) => ({
			glob: entry.glob,
			paths: entry.paths ?? ["$.version"],
			matchedFiles: materializeGlob(entry.glob, projectDir).map((rel) => join(projectDir, rel)),
		}));

		scopes.push({
			name: pkgName,
			workspaceDir: ws.path,
			version: ws.version,
			additionalScopes,
			additionalScopeFiles: additionalScopeFiles.map((rel) => join(projectDir, rel)),
			versionFiles: resolvedVersionFiles,
		});
	}

	return scopes;
}

/**
 * Read a workspace package's raw package.json. A genuinely missing manifest
 * resolves to `null` so the caller can skip that package — a workspace
 * directory without a `package.json` is not a release surface. Any OTHER
 * failure (unreadable file, malformed JSON) is surfaced as a
 * {@link ConfigurationError} carrying the package path, rather than silently
 * dropping the package, which would cascade into wrong attribution.
 */
function readRawPackageJson(
	fs: FileSystem.FileSystem,
	pkgDir: string,
): Effect.Effect<RawPackageJson | null, ConfigurationError> {
	const pkgJsonPath = join(pkgDir, "package.json");
	return fs.readFileString(pkgJsonPath).pipe(
		Effect.flatMap((content) => Effect.try(() => JSON.parse(content) as RawPackageJson)),
		Effect.catchAll((err) => {
			// Effect's FileSystem surfaces a missing file as a SystemError with
			// `reason: "NotFound"`. Treat only that as skippable.
			if ((err as { reason?: unknown }).reason === "NotFound") {
				return Effect.succeed<RawPackageJson | null>(null);
			}
			return Effect.fail(
				new ConfigurationError({
					field: "workspace",
					reason: `Failed to read or parse ${pkgJsonPath}: ${err instanceof Error ? err.message : String(err)}`,
				}),
			);
		}),
	);
}

/**
 * Build resolved scopes from the discovered workspace packages, keeping only
 * those that are a release surface (declare publishConfig that yields at least
 * one publish target). Used when `.changeset/config.json` declares no explicit
 * `packages` record. The changeset `ignore` list is intentionally NOT consulted
 * here — an ignored package still declares publishConfig and remains a valid
 * changeset target.
 */
function buildFallbackScopes(
	fs: FileSystem.FileSystem,
	workspaces: ReadonlyArray<{ name: string; path: string; version: string }>,
): Effect.Effect<ReadonlyArray<ResolvedPackageScope>, ConfigurationError> {
	return Effect.forEach(workspaces, (ws) =>
		Effect.gen(function* () {
			const raw = yield* readRawPackageJson(fs, ws.path);
			if (raw === null) return [] as ResolvedPackageScope[];
			const binding = yield* readTargetsBinding(fs, ws.path);
			const targets = SilkPublishability.detect(ws.name, raw, binding);
			if (targets.length === 0) return [] as ResolvedPackageScope[];
			return [
				{
					name: ws.name,
					workspaceDir: ws.path,
					version: ws.version,
					additionalScopes: [],
					additionalScopeFiles: [],
					versionFiles: [],
				},
			] as ResolvedPackageScope[];
		}),
	).pipe(Effect.map((nested) => nested.flat()));
}

/**
 * Cross-package validation: no overlap in `additionalScopes`, no shadowing
 * of another workspace package's directory (regardless of whether that
 * package is itself declared in `config.packages`), and no duplicate
 * `(file, JSONPath)` tuples in `versionFiles`.
 */
function checkConflicts(
	scopes: ReadonlyArray<ResolvedPackageScope>,
	allWorkspaces: ReadonlyArray<{ name: string; path: string }>,
	projectDir: string,
	configPath: string,
): void {
	// Build a fileOwner map for additionalScopes — every file must belong to
	// at most one package's additionalScopes.
	const scopeOwner = new Map<string, string>();
	for (const s of scopes) {
		for (const f of s.additionalScopeFiles) {
			const prev = scopeOwner.get(f);
			if (prev && prev !== s.name) {
				throw new ConfigurationError({
					field: `packages["${s.name}"].additionalScopes`,
					reason:
						`Overlap in ${configPath}: file ${JSON.stringify(f)} is matched by both ` +
						`"${prev}" and "${s.name}". additionalScopes must not overlap between packages.`,
				});
			}
			scopeOwner.set(f, s.name);
		}
	}

	// Workspace shadowing — an additionalScope file must not be inside a
	// different package's workspace directory. Compare against every known
	// workspace package (from WorkspaceDiscovery), not just the subset
	// declared in `config.packages`. A scope that claims files inside a
	// workspace dir that the config doesn't otherwise mention is still
	// suspicious — it would silently claim "ownership" of release
	// documentation for an unmodeled package.
	//
	// Exclusion: the workspace root itself is not a meaningful "package
	// directory" for shadowing purposes. Every additionalScope file sits
	// inside the project root by definition; the root represents the whole
	// repo, not a sub-package whose release scope we'd accidentally claim.
	for (const s of scopes) {
		for (const f of s.additionalScopeFiles) {
			for (const ws of allWorkspaces) {
				if (ws.name === s.name) continue;
				if (ws.path === projectDir) continue;
				if (isInside(ws.path, f)) {
					throw new ConfigurationError({
						field: `packages["${s.name}"].additionalScopes`,
						reason:
							`Shadowing in ${configPath}: "${s.name}" claims ${JSON.stringify(f)} via additionalScopes, ` +
							`but that path is inside "${ws.name}"'s workspace directory (${ws.path}). ` +
							"A package's additionalScopes must not include another package's workspace files.",
					});
				}
			}
		}
	}

	// versionFiles target tuple uniqueness — (absolute file path, JSONPath).
	const seen = new Map<string, { pkg: string; glob: string }>();
	for (const s of scopes) {
		for (const vf of s.versionFiles) {
			for (const file of vf.matchedFiles) {
				for (const path of vf.paths) {
					const key = `${file}::${path}`;
					const prev = seen.get(key);
					if (prev && (prev.pkg !== s.name || prev.glob !== vf.glob)) {
						throw new ConfigurationError({
							field: `packages["${s.name}"].versionFiles`,
							reason:
								`Conflict in ${configPath}: target (${JSON.stringify(file)}, ${path}) ` +
								`is claimed by both "${prev.pkg}" (glob ${JSON.stringify(prev.glob)}) ` +
								`and "${s.name}" (glob ${JSON.stringify(vf.glob)}). ` +
								"Two versionFiles entries must not resolve to the same (file, JSONPath) tuple.",
						});
					}
					seen.set(key, { pkg: s.name, glob: vf.glob });
				}
			}
		}
	}
}

/**
 * Build a `ConfigurationError` from a Schema `ParseError`. Captures the
 * original message verbatim so the user sees exactly what the schema
 * complained about.
 */
function configErrorFromParseError(parseError: unknown, configPath: string): ConfigurationError {
	return new ConfigurationError({
		field: "options",
		reason: `Invalid options in ${configPath}: ${String(parseError)}`,
	});
}

/* ----------------------------------------------------------------- *
 * Live layer
 * ----------------------------------------------------------------- */

/**
 * Build a {@link ConfigInspectorShape} that closes over already-resolved
 * service implementations. This keeps the public `inspect`/`classify`
 * signatures requirement-free (`R = never`) while still allowing the
 * implementation to use `ChangesetConfigReader` and `WorkspaceDiscovery`.
 *
 * Each shape carries a private cache keyed by absolute project dir so
 * repeat `inspect`/`classify` calls reuse the materialized state.
 */
function makeShape(
	reader: typeof ChangesetConfigReader.Service,
	discovery: typeof WorkspaceDiscovery.Service,
	fs: FileSystem.FileSystem,
): ConfigInspectorShape {
	const cache = new Map<string, InspectedConfig>();

	const inspect = (cwd: string): Effect.Effect<InspectedConfig, ConfigurationError> =>
		Effect.gen(function* () {
			const projectDir = resolve(cwd);
			const cached = cache.get(projectDir);
			if (cached) return cached;

			const config = yield* reader.read(projectDir).pipe(
				Effect.mapError(
					(err) =>
						new ConfigurationError({
							field: "configFile",
							reason: err.message,
						}),
				),
			);

			const configPath = join(projectDir, ".changeset", "config.json");
			const { changelogId, options: rawOptions } = extractChangelogOptions(config);
			const optionsRecord =
				typeof rawOptions === "object" && rawOptions !== null ? (rawOptions as Record<string, unknown>) : {};

			// Schema-level dual-shape rejection — detect early with a friendly
			// message before legacy normalization erases the evidence.
			if (
				Array.isArray(optionsRecord.versionFiles) &&
				typeof optionsRecord.packages === "object" &&
				optionsRecord.packages !== null
			) {
				return yield* Effect.fail(
					new ConfigurationError({
						field: "options",
						reason:
							`Configuration in ${configPath} declares both \`packages\` and the deprecated ` +
							"top-level `versionFiles` array. Migrate the legacy entries into `packages[<name>].versionFiles` " +
							"and remove the top-level field.",
					}),
				);
			}

			let normalized: Record<string, unknown>;
			let legacyUsed: boolean;
			try {
				const result = normalizeLegacyOptions(optionsRecord, configPath);
				normalized = result.normalized;
				legacyUsed = result.legacyUsed;
			} catch (e) {
				if (e instanceof ConfigurationError) return yield* Effect.fail(e);
				throw e;
			}

			const decodedOptions = yield* Schema.decodeUnknown(ChangesetOptionsSchema)(normalized).pipe(
				Effect.mapError((parseError) => configErrorFromParseError(parseError, configPath)),
			);

			const workspaceList = yield* discovery.listPackages(projectDir).pipe(
				Effect.mapError(
					(err) =>
						new ConfigurationError({
							field: "workspace",
							reason: `Workspace discovery failed for ${projectDir}: ${err.message}`,
						}),
				),
			);

			const workspaces = workspaceList.map((w) => ({
				name: w.name,
				path: w.path,
				version: w.version,
			}));

			const hasExplicitPackages = Object.keys(decodedOptions.packages ?? {}).length > 0;

			let scopes: ReadonlyArray<ResolvedPackageScope>;
			if (hasExplicitPackages) {
				try {
					scopes = buildResolvedScopes({
						options: decodedOptions,
						workspaces,
						projectDir,
						configPath,
					});
					checkConflicts(scopes, workspaces, projectDir, configPath);
				} catch (e) {
					if (e instanceof ConfigurationError) return yield* Effect.fail(e);
					throw e;
				}
			} else {
				scopes = yield* buildFallbackScopes(fs, workspaces);
			}

			const inspected: InspectedConfig = {
				configPath,
				projectDir,
				changelog: changelogId,
				baseBranch: (config as { baseBranch?: string }).baseBranch ?? "main",
				access: ((config as { access?: "public" | "restricted" }).access ?? "restricted") as "public" | "restricted",
				ignore: ((config as { ignore?: ReadonlyArray<string> }).ignore ?? []) as ReadonlyArray<string>,
				packages: scopes,
				legacyVersionFilesUsed: legacyUsed,
			};

			cache.set(projectDir, inspected);
			return inspected;
		});

	const classify = (
		cwd: string,
		paths: ReadonlyArray<string>,
	): Effect.Effect<ReadonlyArray<Classification>, ConfigurationError> =>
		Effect.gen(function* () {
			const inspected = yield* inspect(cwd);
			return paths.map((p) => classifyOne(inspected, p));
		});

	return { inspect, classify };
}

/**
 * Classify a single path against an inspected config.
 */
function classifyOne(inspected: InspectedConfig, path: string): Classification {
	const abs = resolve(inspected.projectDir, path);
	// 1. Workspace match — file is inside a package's workspace directory.
	let bestWorkspace: { pkg: string; depth: number } | null = null;
	for (const s of inspected.packages) {
		if (isInside(s.workspaceDir, abs)) {
			const depth = s.workspaceDir.length;
			if (!bestWorkspace || depth > bestWorkspace.depth) {
				bestWorkspace = { pkg: s.name, depth };
			}
		}
	}
	if (bestWorkspace) {
		return { path, package: bestWorkspace.pkg, reason: "workspace" };
	}

	// 2. additionalScopes match — most specific glob wins (longest glob string
	// is a reasonable proxy when materialization fingerprints don't help).
	for (const s of inspected.packages) {
		if (s.additionalScopeFiles.includes(abs)) {
			// Pick the glob that produced the match. Materialization order
			// preserves config order; the first matching glob is good enough.
			const glob = s.additionalScopes.find((g) =>
				materializeGlob(g, inspected.projectDir)
					.map((rel) => join(inspected.projectDir, rel))
					.includes(abs),
			);
			return {
				path,
				package: s.name,
				reason: { kind: "additionalScope", glob: glob ?? s.additionalScopes[0] ?? "" },
			};
		}
	}

	// 3. versionFiles match — the file is a version target for some package.
	for (const s of inspected.packages) {
		for (const vf of s.versionFiles) {
			if (vf.matchedFiles.includes(abs)) {
				return { path, package: s.name, reason: { kind: "versionFile", glob: vf.glob } };
			}
		}
	}

	return { path, package: null, reason: null };
}

/**
 * Live layer for {@link ConfigInspector}.
 *
 * Requires {@link ChangesetConfigReader} and {@link WorkspaceDiscovery}
 * in the environment.
 *
 * @public
 */
export const ConfigInspectorLive: Layer.Layer<
	ConfigInspector,
	never,
	ChangesetConfigReader | WorkspaceDiscovery | FileSystem.FileSystem
> = Layer.effect(
	ConfigInspector,
	Effect.gen(function* () {
		const reader = yield* ChangesetConfigReader;
		const discovery = yield* WorkspaceDiscovery;
		const fs = yield* FileSystem.FileSystem;
		return makeShape(reader, discovery, fs);
	}),
);

/**
 * Test factory — build a {@link ConfigInspector} that returns a fixed
 * {@link InspectedConfig} without touching the filesystem.
 *
 * Tests that need to exercise the inspect/classify logic against real files
 * should compose `ConfigInspectorLive` with test layers for
 * `ChangesetConfigReader` and `WorkspaceDiscovery` instead.
 *
 * @public
 */
export function makeConfigInspectorTest(fixed: InspectedConfig): Layer.Layer<ConfigInspector> {
	const shape: ConfigInspectorShape = {
		inspect: () => Effect.succeed(fixed),
		classify: (_cwd, paths) => Effect.succeed(paths.map((p) => classifyOne(fixed, p))),
	};
	return Layer.succeed(ConfigInspector, shape);
}
