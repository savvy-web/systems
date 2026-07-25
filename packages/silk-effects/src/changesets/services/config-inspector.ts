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
 */

import { isAbsolute, join, relative, resolve } from "node:path";
import { GlobPattern, GlobPatternOptions } from "@effected/glob";
import { compileAndExpand } from "@effected/walker";
import type { WorkspaceDiscoveryShape } from "@effected/workspaces";
import { WorkspaceDiscovery } from "@effected/workspaces";
import { Context, Effect, FileSystem, Layer, Path, Result, Schema } from "effect";
import type { ChangesetConfigReaderShape } from "../../services/ChangesetConfigReader.js";
import { ChangesetConfigReader } from "../../services/ChangesetConfigReader.js";
import type { RawPackageJson } from "../../services/SilkPublishability.js";
import { SilkPublishability, readTargetsBinding } from "../../services/SilkPublishability.js";

import { ConfigurationError } from "../errors.js";
import { ChangesetOptionsSchema } from "../schemas/options.js";
import type { VersionFileConfig } from "../schemas/version-files.js";

/** A `versionFiles` entry expanded to its absolute target paths. @public */
export const ResolvedVersionFileSchema = Schema.Struct({
	glob: Schema.String,
	paths: Schema.Array(Schema.String).annotate({
		description: 'JSONPath expressions to update (defaults to ["$.version"]).',
	}),
	matchedFiles: Schema.Array(Schema.String),
}).annotate({ identifier: "ResolvedVersionFile" });
/** A `versionFiles` entry expanded to its absolute target paths. @public */
export type ResolvedVersionFile = typeof ResolvedVersionFileSchema.Type;

/** A package's resolved release surface. @public */
export const ResolvedPackageScopeSchema = Schema.Struct({
	name: Schema.String,
	workspaceDir: Schema.String,
	version: Schema.String,
	additionalScopes: Schema.Array(Schema.String),
	additionalScopeFiles: Schema.Array(Schema.String),
	versionFiles: Schema.Array(ResolvedVersionFileSchema),
}).annotate({ identifier: "ResolvedPackageScope" });
/** A package's resolved release surface. @public */
export type ResolvedPackageScope = typeof ResolvedPackageScopeSchema.Type;

/** Structured representation of a resolved `.changeset/config.json`. @public */
export const InspectedConfigSchema = Schema.Struct({
	configPath: Schema.String,
	projectDir: Schema.String.annotate({
		description: "Absolute project root (the directory containing .changeset/).",
	}),
	changelog: Schema.NullOr(Schema.String),
	baseBranch: Schema.String,
	access: Schema.Literals(["public", "restricted"]),
	ignore: Schema.Array(Schema.String),
	packages: Schema.Array(ResolvedPackageScopeSchema),
	legacyVersionFilesUsed: Schema.Boolean,
}).annotate({ identifier: "InspectedConfig" });
/** Structured representation of a resolved `.changeset/config.json`. @public */
export type InspectedConfig = typeof InspectedConfigSchema.Type;

/** Reason a path was attributed to a package (or left unmapped). @public */
export const ClassificationReasonSchema = Schema.Union([
	Schema.Literal("workspace"),
	Schema.Struct({ kind: Schema.Literal("additionalScope"), glob: Schema.String }),
	Schema.Struct({ kind: Schema.Literal("versionFile"), glob: Schema.String }),
	Schema.Null,
]).annotate({ identifier: "ClassificationReason" });
/** Reason a path was attributed to a package (or left unmapped). @public */
export type ClassificationReason = typeof ClassificationReasonSchema.Type;

/** The result of classifying a single path against a resolved config. @public */
export const ClassificationSchema = Schema.Struct({
	path: Schema.String,
	package: Schema.NullOr(Schema.String),
	reason: ClassificationReasonSchema,
}).annotate({ identifier: "Classification" });
/** The result of classifying a single path against a resolved config. @public */
export type Classification = typeof ClassificationSchema.Type;

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

	/**
	 * Drop the cached {@link InspectedConfig} for every previously-inspected
	 * root, and refresh the underlying `WorkspaceDiscovery` snapshot. Callers
	 * that hold this service across multiple logical operations in a single
	 * process (e.g. a long-lived MCP server) must call this before an
	 * operation that needs to observe on-disk edits made since the last
	 * `inspect`/`classify` call — the cache never expires on its own.
	 *
	 * @returns An Effect that clears the cache and succeeds with `void`.
	 */
	readonly refresh: () => Effect.Effect<void>;
}

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
export class ConfigInspector extends Context.Service<ConfigInspector, ConfigInspectorShape>()("ConfigInspector") {}

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

/** Match dotfiles, mirroring the former tinyglobby `dot: true` behavior. */
const GLOB_OPTIONS = GlobPatternOptions.make({ dot: true });

/**
/**
 * Pure attribution helper: does `glob` (under this service's `dot: true`
 * semantics) match the repo-relative POSIX path `rel`? An uncompilable
 * pattern matches nothing.
 */
function globMatchesRel(glob: string, rel: string): boolean {
	const result = GlobPattern.compileResult(glob, GLOB_OPTIONS);
	return Result.isSuccess(result) && result.success.matches(rel);
}

/**
 * Materialize a glob against `cwd` and return the matched file paths as
 * repo-relative POSIX strings, sorted by relative path. Matches dotfiles (the
 * former tinyglobby `dot: true` semantics); the walk is `@effected/walker`'s
 * `descend` (literal fast path, `enumerationPrefix` bounding,
 * `node_modules`/`.git` pruning), with `onUnreadable: "skip"` preserving the
 * previous silent-skip policy for unreadable directories. The one remaining
 * `DescendError` (depth cap) folds into a {@link ConfigurationError} naming
 * the glob — this service's single typed failure. `descend`'s `Path`
 * requirement is satisfied internally with the core POSIX `Path.layer` (this
 * module already speaks POSIX-relative match paths).
 */
function materializeGlob(
	glob: string,
	cwd: string,
): Effect.Effect<ReadonlyArray<string>, ConfigurationError, FileSystem.FileSystem> {
	return compileAndExpand(glob, { cwd, onUnreadable: "skip", glob: GLOB_OPTIONS }).pipe(
		Effect.mapError(
			(error) =>
				new ConfigurationError({
					field: "glob",
					reason:
						error.stage === "compile"
							? `Invalid glob pattern ${JSON.stringify(glob)}: ${error.cause.message}`
							: `Failed to materialize glob ${JSON.stringify(glob)}: ${error.cause.message}`,
				}),
		),
		Effect.provide(Path.layer),
	);
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
	readonly options: typeof ChangesetOptionsSchema.Type;
	readonly workspaces: ReadonlyArray<{ name: string; path: string; version: string }>;
	readonly projectDir: string;
	readonly configPath: string;
}): Effect.Effect<ReadonlyArray<ResolvedPackageScope>, ConfigurationError, FileSystem.FileSystem> {
	return Effect.gen(function* () {
		const { options, workspaces, projectDir, configPath } = params;
		const packages = options.packages ?? {};
		const workspacesByName = new Map(workspaces.map((w) => [w.name, w] as const));

		const scopes: ResolvedPackageScope[] = [];
		for (const [pkgName, scope] of Object.entries(packages)) {
			const ws = workspacesByName.get(pkgName);
			if (!ws) {
				return yield* Effect.fail(
					new ConfigurationError({
						field: `packages["${pkgName}"]`,
						reason:
							`Unknown package "${pkgName}" in ${configPath}. ` +
							`Known workspace packages: ${workspaces.map((w) => w.name).join(", ") || "(none)"}.`,
					}),
				);
			}

			const additionalScopes: ReadonlyArray<string> = scope.additionalScopes ?? [];
			const additionalScopeFiles: string[] = [];
			for (const g of additionalScopes) {
				additionalScopeFiles.push(...(yield* materializeGlob(g, projectDir)));
			}
			const versionFileEntries = scope.versionFiles ?? ([] as ReadonlyArray<VersionFileConfig>);
			const resolvedVersionFiles: ResolvedVersionFile[] = [];
			for (const entry of versionFileEntries) {
				const matched = yield* materializeGlob(entry.glob, projectDir);
				resolvedVersionFiles.push({
					glob: entry.glob,
					paths: entry.paths ?? ["$.version"],
					matchedFiles: matched.map((rel) => join(projectDir, rel)),
				});
			}

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
	});
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
		Effect.catch((err) => {
			// v4's FileSystem surfaces a missing file as a PlatformError wrapping a
			// SystemError whose `_tag` is "NotFound". Treat only that as skippable.
			if ((err as { reason?: { _tag?: unknown } }).reason?._tag === "NotFound") {
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
 * those that are a release surface: a package that declares publishConfig
 * yielding at least one publish target, OR — when the changeset config sets
 * `privatePackages.version: true` (`versionPrivate`) — any workspace package
 * at all, since changesets versions private packages too in that mode (#360:
 * a private single-root repo with `privatePackages.version: true` previously
 * produced an empty release surface and left every file unmapped). Used both
 * when `.changeset/config.json` declares no explicit `packages` record AND to
 * augment an explicit record with the remaining workspace packages it does
 * not list (so the record annotates the listed packages without shrinking the
 * release surface). The changeset `ignore` list is intentionally NOT
 * consulted here — an ignored package still declares publishConfig and
 * remains a valid changeset target.
 */
function buildFallbackScopes(
	fs: FileSystem.FileSystem,
	workspaces: ReadonlyArray<{ name: string; path: string; version: string }>,
	versionPrivate: boolean,
): Effect.Effect<ReadonlyArray<ResolvedPackageScope>, ConfigurationError> {
	return Effect.forEach(workspaces, (ws) =>
		Effect.gen(function* () {
			const raw = yield* readRawPackageJson(fs, ws.path);
			if (raw === null) return [] as ResolvedPackageScope[];
			const binding = yield* readTargetsBinding(fs, ws.path);
			const targets = SilkPublishability.detect(ws.name, raw, binding);
			if (targets.length === 0 && !versionPrivate) return [] as ResolvedPackageScope[];
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
	reader: ChangesetConfigReaderShape,
	discovery: WorkspaceDiscoveryShape,
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

			const decodedOptions = yield* Schema.decodeUnknownEffect(ChangesetOptionsSchema)(normalized).pipe(
				Effect.mapError((parseError) => configErrorFromParseError(parseError, configPath)),
			);

			// The kit's discovery is bound to the root its layer was built with
			// (`WorkspaceDiscovery.layer({ cwd })`) — the inspector is single-root
			// by design, so `projectDir` must match that root.
			const workspaceList = yield* discovery.listPackages().pipe(
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

			// `privatePackages.version: true` means changesets versions private
			// packages too, so an unpublishable package is still a release
			// surface. Mirrors ChangesetConfig.versionPrivate — the truth-table
			// is `pp !== undefined && pp !== false && pp.version === true`.
			const privatePackages = config.privatePackages;
			const versionPrivate =
				privatePackages !== undefined && privatePackages !== false && privatePackages.version === true;

			let scopes: ReadonlyArray<ResolvedPackageScope>;
			if (hasExplicitPackages) {
				const explicitScopes: ReadonlyArray<ResolvedPackageScope> = yield* buildResolvedScopes({
					options: decodedOptions,
					workspaces,
					projectDir,
					configPath,
				}).pipe(Effect.provideService(FileSystem.FileSystem, fs));
				try {
					checkConflicts(explicitScopes, workspaces, projectDir, configPath);
				} catch (e) {
					if (e instanceof ConfigurationError) return yield* Effect.fail(e);
					throw e;
				}

				// A `packages` record annotates the listed packages (their
				// additionalScopes / versionFiles); it must NOT shrink the release
				// surface to just those packages. Discover the remaining
				// release-surface workspace packages — the same fallback used when
				// no `packages` record is present — and append them so attribution
				// still covers the whole monorepo. The annotated packages keep
				// their richer explicit scopes and are excluded from the fallback.
				const explicitNames = new Set(explicitScopes.map((s) => s.name));
				const remaining = workspaces.filter((w) => !explicitNames.has(w.name));
				const discoveredScopes = yield* buildFallbackScopes(fs, remaining, versionPrivate);
				scopes = [...explicitScopes, ...discoveredScopes];
			} else {
				scopes = yield* buildFallbackScopes(fs, workspaces, versionPrivate);
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

	const refresh = (): Effect.Effect<void> =>
		Effect.gen(function* () {
			cache.clear();
			yield* discovery.refresh();
		});

	return { inspect, classify, refresh };
}

/**
 * Classify a single path against an inspected config.
 */
function classifyOne(inspected: InspectedConfig, path: string): Classification {
	const abs = resolve(inspected.projectDir, path);
	// 1. Workspace match — file is inside a package's workspace directory.
	//
	// A root-as-package scope (workspaceDir === projectDir) is deliberately
	// held back from this pass and only applied at the end. Every file in the
	// repo is "inside" the root by definition, so letting it compete here would
	// make it win containment for any path outside a sub-package directory and
	// silently shadow the additionalScopes and versionFiles a config declared
	// for that path. `checkConflicts` already carves the root out of shadowing
	// validation for the same reason: the root represents the whole repo, not a
	// sub-package whose directory claims ownership.
	let bestWorkspace: { pkg: string; depth: number } | null = null;
	let rootScope: string | null = null;
	for (const s of inspected.packages) {
		if (s.workspaceDir === inspected.projectDir) {
			rootScope = s.name;
			continue;
		}
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
			// Pick the glob that produced the match by PURE pattern matching
			// against the projectDir-relative POSIX path: `abs` is already known
			// to be a walk artifact (member of additionalScopeFiles), so
			// membership implies its pattern matches. The previous re-walk added
			// filesystem IO to a pure classification and made
			// `makeConfigInspectorTest` secretly filesystem-dependent. Config
			// order is preserved; the first matching glob is good enough.
			const rel = relative(inspected.projectDir, abs).replaceAll("\\", "/");
			const glob = s.additionalScopes.find((g) => globMatchesRel(g, rel));
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

	// 4. Root-as-package fallback — a versioned root package owns whatever no
	// sub-package directory, additionalScope or versionFile claimed. This is
	// what makes a single-package repo whose only package IS the root attribute
	// its files at all, without letting the root outrank a more specific claim.
	//
	// Still containment-checked: `resolve` happily returns a path outside the
	// project for a `../` or absolute input, and the root owning a file that
	// isn't in the repo would be a worse answer than owning nothing.
	if (rootScope && isInside(inspected.projectDir, abs)) {
		return { path, package: rootScope, reason: "workspace" };
	}

	return { path, package: null, reason: null };
}

/**
 * Live layer for {@link ConfigInspector}.
 *
 * Requires {@link ChangesetConfigReader} and `WorkspaceDiscovery`
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
		refresh: () => Effect.void,
	};
	return Layer.succeed(ConfigInspector, shape);
}
