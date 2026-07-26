import type {
	CyclicDependencyError,
	PackageManagerDetectionFailure,
	WorkspaceDiscoveryFailure,
} from "@effected/workspaces";
import { DependencyGraph, PackageManagerDetector, VersioningStrategy, WorkspaceDiscovery } from "@effected/workspaces";
import { Context, Effect, FileSystem, Layer, Option } from "effect";
import { WorkspaceAnalysisError } from "../errors/WorkspaceAnalysisError.js";
import type { ChangesetConfigFile, SilkChangesetConfigFile } from "../schemas/VersioningSchemas.js";
import { AnalyzedWorkspace, WorkspaceAnalysis } from "../schemas/WorkspaceAnalysisSchemas.js";
import { ChangesetConfig } from "./ChangesetConfig.js";
import { ChangesetConfigReader } from "./ChangesetConfigReader.js";
import type { RawPackageJson } from "./SilkPublishability.js";
import { SilkPublishability, readTargetsBinding } from "./SilkPublishability.js";

/**
 * The {@link SilkWorkspaceAnalyzer} service shape.
 *
 * @since 3.2.0
 * @public
 */
export interface SilkWorkspaceAnalyzerShape {
	/**
	 * Analyze a workspace root and produce a full {@link WorkspaceAnalysis}.
	 *
	 * @param root - Absolute path to the workspace root directory. Must match
	 *   the root that the `WorkspaceDiscovery` layer was initialised with. The analyzer
	 *   is single-root by design — build a fresh layer per workspace root.
	 * @returns An `Effect` that succeeds with a {@link WorkspaceAnalysis}, or
	 *   fails with {@link WorkspaceAnalysisError}.
	 *
	 * @since 0.2.0
	 */
	readonly analyze: (root: string) => Effect.Effect<WorkspaceAnalysis, WorkspaceAnalysisError>;
}

/**
 * Service that performs a full workspace analysis — discovering packages,
 * detecting publishability, computing versioning/tag strategies, and
 * wiring up fixed/linked release groups.
 *
 * @remarks
 * Orchestrates `WorkspaceDiscovery`, `PackageManagerDetector` and
 * {@link ChangesetConfigReader}, then classifies the result with
 * `@effected/workspaces`' pure `VersioningStrategy` value class, to produce a
 * complete {@link WorkspaceAnalysis} for a given workspace root.
 *
 * @example
 * ```typescript
 * const result = await Effect.runPromise(
 *   Effect.gen(function* () {
 *     const analyzer = yield* SilkWorkspaceAnalyzer;
 *     return yield* analyzer.analyze("/path/to/monorepo");
 *   }).pipe(
 *     Effect.provide(SilkWorkspaceAnalyzerLive),
 *     // ... provide all transitive layers
 *   )
 * );
 * ```
 *
 * @since 0.2.0
 * @public
 */
export class SilkWorkspaceAnalyzer extends Context.Service<SilkWorkspaceAnalyzer, SilkWorkspaceAnalyzerShape>()(
	"@savvy-web/silk-effects/SilkWorkspaceAnalyzer",
) {}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Read the raw package.json from disk as an untyped record.
 *
 * @remarks
 * We read from disk rather than using WorkspacePackage.publishConfig because
 * the upstream PublishConfig schema strips unknown fields (like Silk `targets`).
 * SilkPublishability.detect needs the full raw publishConfig.
 */
const readRawPkgJson = (
	fs: FileSystem.FileSystem,
	packageJsonPath: string,
): Effect.Effect<Record<string, unknown>, WorkspaceAnalysisError> =>
	fs.readFileString(packageJsonPath).pipe(
		Effect.flatMap((content) =>
			Effect.try({
				try: () => JSON.parse(content) as Record<string, unknown>,
				catch: () => new WorkspaceAnalysisError({ root: packageJsonPath, reason: "Invalid JSON in package.json" }),
			}),
		),
		Effect.mapError((err) =>
			err instanceof WorkspaceAnalysisError
				? err
				: new WorkspaceAnalysisError({
						root: packageJsonPath,
						reason: `Failed to read package.json: ${String(err)}`,
					}),
		),
	);

/**
 * Determine the release status flags (versioned, tagged, released) for a workspace
 * based on the changeset config.
 *
 * @param pkgName - The package name.
 * @param isPrivate - Whether package.json has `private: true`.
 * @param isPublishable - Whether the package has resolved publish targets.
 *   A package with `private: true` + `publishConfig.access` is publishable
 *   in Silk convention and should be versioned/tagged like a public package.
 * @param config - The changeset config, or null if no changesets.
 */
function computeReleaseStatus(
	pkgName: string,
	isPrivate: boolean,
	isPublishable: boolean,
	config: ChangesetConfigFile | SilkChangesetConfigFile | null,
): { versioned: boolean; tagged: boolean; released: boolean } {
	// No changesets config → nothing is versioned/tagged/released
	if (config == null) {
		return { versioned: false, tagged: false, released: false };
	}

	// Package in ignore list → not versioned/tagged/released
	if ((config.ignore ?? []).some((p) => ChangesetConfig.matches(pkgName, p))) {
		return { versioned: false, tagged: false, released: false };
	}

	// Public package OR publishable private package → versioned + tagged
	// In Silk convention, private: true + publishConfig.access means
	// "source is private, built artifact is published" — treat as public.
	if (!isPrivate || isPublishable) {
		return { versioned: true, tagged: true, released: true };
	}

	// Truly private package (no publish targets) — check privatePackages config
	const pp = (config as { privatePackages?: false | { version?: boolean; tag?: boolean } }).privatePackages;

	// No privatePackages config → defaults: not versioned
	if (pp === undefined) {
		return { versioned: false, tagged: false, released: false };
	}

	// privatePackages: false → completely ignored
	if (pp === false) {
		return { versioned: false, tagged: false, released: false };
	}

	// privatePackages: { version, tag }
	const versioned = pp.version === true;
	const tagged = pp.tag === true;
	const released = versioned && tagged;
	return { versioned, tagged, released };
}

// ---------------------------------------------------------------------------
// Live layer
// ---------------------------------------------------------------------------

/**
 * Live implementation of {@link SilkWorkspaceAnalyzer}.
 *
 * @remarks
 * Requires `WorkspaceDiscovery`, `PackageManagerDetector` and
 * {@link ChangesetConfigReader}. Versioning and tag classification are pure
 * `@effected/workspaces` value operations, so neither adds a requirement.
 *
 * @since 0.2.0
 * @public
 */
export const SilkWorkspaceAnalyzerLive: Layer.Layer<
	SilkWorkspaceAnalyzer,
	never,
	FileSystem.FileSystem | WorkspaceDiscovery | PackageManagerDetector | ChangesetConfigReader
> = Layer.effect(
	SilkWorkspaceAnalyzer,
	Effect.gen(function* () {
		const fs = yield* FileSystem.FileSystem;
		const discovery = yield* WorkspaceDiscovery;
		const pmDetector = yield* PackageManagerDetector;
		const configReader = yield* ChangesetConfigReader;

		const analyze = (root: string): Effect.Effect<WorkspaceAnalysis, WorkspaceAnalysisError> =>
			Effect.gen(function* () {
				// 1. Detect package manager and runtime
				const pm = yield* pmDetector.detect(root).pipe(
					Effect.mapError(
						(err: PackageManagerDetectionFailure) =>
							new WorkspaceAnalysisError({
								root,
								reason: `Package manager detection failed: ${String(err)}`,
							}),
					),
				);

				// 2. Discover workspace packages. The kit's discovery is bound to
				// the root its layer was built with (`WorkspaceDiscovery.layer({ cwd })`)
				// — the analyzer is single-root by design, so `root` must match it.
				const packages = yield* discovery.listPackages().pipe(
					Effect.mapError(
						(err: WorkspaceDiscoveryFailure) =>
							new WorkspaceAnalysisError({
								root,
								reason: `Workspace discovery failed: ${String(err)}`,
							}),
					),
				);

				// 3. Get topological sort order (dependencies first) over the
				// discovered packages — a pure DependencyGraph value, no service.
				// `make` accepts the ReadonlyArray directly (kit round 3 verified
				// Schema.$Array's make-input is ReadonlyArray on beta.98).
				const graph = DependencyGraph.make({ packages });
				const topoOrder = yield* graph.sort().pipe(
					Effect.mapError(
						(err: CyclicDependencyError) =>
							new WorkspaceAnalysisError({
								root,
								reason: `Cyclic dependency detected: ${String(err)}`,
							}),
					),
				);

				// Reorder packages by topological sort (root first, then
				// dependencies-first order). When the topo order was built from a
				// different workspace root (e.g. in tests) it will not contain
				// our package names, so fall back to the discovery order.
				const packagesByName = new Map(packages.map((p) => [p.name, p]));
				const reordered = topoOrder.flatMap((name) => {
					const pkg = packagesByName.get(name);
					return pkg ? [pkg] : [];
				});
				const sortedPackages = reordered.length > 0 ? reordered : [...packages];

				// 4. Read changeset config (optional — may not exist)
				const changesetConfigOption = yield* configReader.read(root).pipe(Effect.option);
				const changesetConfig = Option.getOrNull(changesetConfigOption);

				// 5. Compute publishability for each workspace
				const analyzedWorkspaces: AnalyzedWorkspace[] = [];

				for (const pkg of sortedPackages) {
					const pkgJson = yield* readRawPkgJson(fs, pkg.packageJsonPath);
					const binding = yield* readTargetsBinding(fs, pkg.path);
					const targets = SilkPublishability.detect(pkg.name, pkgJson as RawPackageJson, binding);

					const isPublishable = targets.length > 0;
					const isRoot = pkg.relativePath === ".";

					// 6. Compute release status
					const { versioned, tagged, released } = computeReleaseStatus(
						pkg.name,
						pkg.private,
						isPublishable,
						changesetConfig,
					);

					const analyzed = new AnalyzedWorkspace({
						name: pkg.name,
						version: { current: pkg.version },
						path: pkg.path,
						root: isRoot,
						publishConfig: null,
						publishable: isPublishable,
						targets: [...targets],
						versioned,
						tagged,
						released,
						linked: [],
						fixed: [],
					});

					analyzedWorkspaces.push(analyzed);
				}

				// 7. Wire up fixed/linked group references (immutable reconstruction)
				if (changesetConfig) {
					const fixedGroups = changesetConfig.fixed ?? [];
					const linkedGroups = changesetConfig.linked ?? [];

					const fixedByName = new Map<string, AnalyzedWorkspace[]>();
					for (const group of fixedGroups) {
						const members = analyzedWorkspaces.filter((w) => group.includes(w.name));
						for (const member of members) {
							fixedByName.set(
								member.name,
								members.filter((m) => m !== member),
							);
						}
					}

					const linkedByName = new Map<string, AnalyzedWorkspace[]>();
					for (const group of linkedGroups) {
						const members = analyzedWorkspaces.filter((w) => group.includes(w.name));
						for (const member of members) {
							linkedByName.set(
								member.name,
								members.filter((m) => m !== member),
							);
						}
					}

					for (let i = 0; i < analyzedWorkspaces.length; i++) {
						const ws = analyzedWorkspaces[i];
						const fixedRefs = fixedByName.get(ws.name) ?? [];
						const linkedRefs = linkedByName.get(ws.name) ?? [];
						if (fixedRefs.length > 0 || linkedRefs.length > 0) {
							analyzedWorkspaces[i] = new AnalyzedWorkspace({
								...ws,
								fixed: fixedRefs,
								linked: linkedRefs,
							});
						}
					}
				}

				// 8. Compute versioning strategy. `classify` is pure and total, and
				// the fixed groups come from the config already read at step 4 —
				// the kit deliberately takes them as a plain argument rather than
				// reading one release tool's config file itself.
				const publishableNames = analyzedWorkspaces.filter((w) => w.publishable).map((w) => w.name);

				const versioning = VersioningStrategy.classify({
					packages: publishableNames,
					fixedGroups: changesetConfig?.fixed ?? [],
				});

				// 9. Tag strategy follows from the versioning classification.
				const tagStrategyType = versioning.tagStyle;

				// 10. Build the final WorkspaceAnalysis
				return new WorkspaceAnalysis({
					root,
					runtime: pm.runtime,
					packageManager: {
						type: pm.name,
						// Conditional spread: v4 constructors validate, and the kit
						// reports the version as an Option — never pass explicit undefined.
						...(Option.isSome(pm.version) ? { version: pm.version.value } : {}),
					},
					workspaces: analyzedWorkspaces,
					changesetConfig,
					versioning,
					tagStrategy: tagStrategyType,
				});
			});

		return { analyze };
	}),
);
