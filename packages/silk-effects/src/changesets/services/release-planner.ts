/**
 * `ReleasePlanner` service — drive the genuine changesets release engine to
 * compute a plan, render a read-only preview, or natively apply a release.
 *
 * @remarks
 * `preview` and `apply` both run the real `@changesets/apply-release-plan`;
 * `preview` redirects every write into a throwaway temp directory by handing
 * the engine a `@manypkg`-shaped `Packages` object whose `dir`s point at temp,
 * then reads the generated CHANGELOG blocks back. No changesets-internal logic
 * (e.g. `getChangelogEntry`) is re-implemented.
 *
 */

import { dirname, isAbsolute, join, relative } from "node:path";
import { applyReleasePlan } from "@changesets/apply-release-plan";
import { readConfig } from "@changesets/config";
import { getReleasePlan } from "@changesets/get-release-plan";
import type { Config, Packages, ReleasePlan } from "@changesets/types";
import { getPackages } from "@manypkg/get-packages";
import { Context, Effect, FileSystem, Layer } from "effect";
import { ChangelogTransformer } from "../api/transformer.js";
import { ReleasePlanError } from "../errors.js";
import type {
	AppliedRelease,
	BumpType,
	ChangesetPreview,
	PendingChangeset,
	PreviewRelease,
} from "../schemas/release-plan.js";
import { VersionFiles } from "../utils/version-files.js";
import type { ConfigInspectorShape } from "./config-inspector.js";
import { ConfigInspector } from "./config-inspector.js";
import type { MaintenanceReason } from "./maintenance-reason.js";
import { deriveMaintenanceReason } from "./maintenance-reason.js";

const errMsg = (e: unknown): string => (e instanceof Error ? e.message : String(e));

/**
 * Read the changesets config, surfacing non-throwing `readConfig` errors as a
 * thrown `Error` so callers inside `Effect.tryPromise` land on the existing
 * `ReleasePlanError` mapping. Warnings are returned alongside the config so
 * the caller can log them via the Effect runtime rather than console output.
 */
async function loadConfig(root: string, packages: Packages): Promise<{ config: Config; warnings: string[] }> {
	const configResult = await readConfig(root, packages);
	if (configResult.config === undefined) {
		throw new Error(`Invalid changeset config:\n${configResult.errors.join("\n")}`);
	}
	return { config: configResult.config, warnings: configResult.warnings };
}

/** The `ReleasePlanner` service surface. @public */
export interface ReleasePlannerShape {
	/** Compute the in-memory release plan (read-only). */
	readonly plan: (root: string) => Effect.Effect<ReleasePlan, ReleasePlanError>;
	/** Render a non-destructive preview of the next release. */
	readonly preview: (root: string) => Effect.Effect<ChangesetPreview, ReleasePlanError>;
	/** Natively apply the release (destructive unless `dryRun`). */
	readonly apply: (
		root: string,
		options?: {
			readonly dryRun?: boolean;
			/**
			 * Map configured changelog ids to absolute module paths. When set,
			 * `config.changelog[0]` must be a key of this map (rewritten before the
			 * engine call; unmapped ids fail) and the engine's `format` integration
			 * is disabled — callers in no-`node_modules` contexts own formatting.
			 */
			readonly changelogModules?: Readonly<Record<string, string>>;
		},
	) => Effect.Effect<AppliedRelease, ReleasePlanError>;
}

/** Effect service tag for the release planner. @public */
export class ReleasePlanner extends Context.Service<ReleasePlanner, ReleasePlannerShape>()("ReleasePlanner") {}

/** Build the service shape over a resolved {@link ConfigInspector} and {@link FileSystem.FileSystem}. */
function makeShape(inspector: ConfigInspectorShape, fs: FileSystem.FileSystem): ReleasePlannerShape {
	const plan: ReleasePlannerShape["plan"] = (root) =>
		Effect.tryPromise({
			try: () => getReleasePlan(root),
			catch: (e) => new ReleasePlanError({ phase: "plan", reason: errMsg(e) }),
		});

	const preview: ReleasePlannerShape["preview"] = (root) => previewEffect(root, fs);

	const apply: ReleasePlannerShape["apply"] = (root, options) =>
		applyEffect(root, options?.dryRun ?? false, options?.changelogModules, inspector, fs);

	return { plan, preview, apply };
}

/** Production layer. Requires {@link ConfigInspector} (used by `apply`) and `FileSystem`. @public */
export const ReleasePlannerLive: Layer.Layer<ReleasePlanner, never, ConfigInspector | FileSystem.FileSystem> =
	Layer.effect(
		ReleasePlanner,
		Effect.gen(function* () {
			const inspector = yield* ConfigInspector;
			const fs = yield* FileSystem.FileSystem;
			return makeShape(inspector, fs);
		}),
	);

/**
 * Test factory — supply fixed results for any subset of methods. Unsupplied
 * methods fail with a `ReleasePlanError`.
 *
 * @public
 */
export function makeReleasePlannerTest(fixed: {
	readonly plan?: ReleasePlan;
	readonly preview?: ChangesetPreview;
	readonly apply?: AppliedRelease;
}): Layer.Layer<ReleasePlanner> {
	const fail = (phase: "plan" | "preview" | "apply") =>
		Effect.fail(new ReleasePlanError({ phase, reason: "not provided in test layer" }));
	const shape: ReleasePlannerShape = {
		plan: () => (fixed.plan ? Effect.succeed(fixed.plan) : fail("plan")),
		preview: () => (fixed.preview ? Effect.succeed(fixed.preview) : fail("preview")),
		apply: () => (fixed.apply ? Effect.succeed(fixed.apply) : fail("apply")),
	};
	return Layer.succeed(ReleasePlanner, shape);
}

/** Extract the `## <version>` block (down to the next H2 or EOF) from a changelog. */
export function extractVersionBlock(changelog: string, version: string): string {
	const lines = changelog.split("\n");
	const start = lines.findIndex((l) => l.trim() === `## ${version}`);
	if (start === -1) return "";
	let end = lines.length;
	for (let i = start + 1; i < lines.length; i++) {
		if (/^## /.test(lines[i])) {
			end = i;
			break;
		}
	}
	return lines.slice(start, end).join("\n").trim();
}

/** Maintenance reasons for every changeset-less release in the plan, keyed by package name. */
function maintenanceReasons(plan: ReleasePlan, config: Config): Map<string, MaintenanceReason> {
	const reasons = new Map<string, MaintenanceReason>();
	for (const r of plan.releases) {
		if (r.type === "none") continue;
		const reason = deriveMaintenanceReason(r, plan, config);
		if (reason) reasons.set(r.name, reason);
	}
	return reasons;
}

/**
 * Render a non-destructive preview by redirecting every write into a
 * scope-managed temp directory (cleaned up automatically when the scope
 * closes) and reading the generated CHANGELOG blocks back.
 */
function previewEffect(root: string, fs: FileSystem.FileSystem): Effect.Effect<ChangesetPreview, ReleasePlanError> {
	const program = Effect.gen(function* () {
		// v3 `readPreState` (invoked internally by `getReleasePlan`) rewrites a
		// legacy `pre.json` in place as an auto-migration — acceptable, but it
		// means even this read-only preview path can touch disk when `pre.json`
		// is stale.
		const [plan, packages] = yield* Effect.tryPromise({
			try: () => Promise.all([getReleasePlan(root), getPackages(root)]),
			catch: (e) => new ReleasePlanError({ phase: "preview", reason: errMsg(e) }),
		});
		if (!packages.rootPackage) {
			return yield* Effect.fail(
				new ReleasePlanError({ phase: "preview", reason: `Workspace root has no package.json: ${root}` }),
			);
		}
		const rootPackage = packages.rootPackage;
		const { config, warnings } = yield* Effect.tryPromise({
			try: () => loadConfig(root, packages),
			catch: (e) => new ReleasePlanError({ phase: "preview", reason: errMsg(e) }),
		});
		yield* Effect.forEach(warnings, (w) => Effect.logWarning(w));
		const reasonByName = maintenanceReasons(plan, config);

		const preMode: ChangesetPreview["preMode"] = plan.preState ? plan.preState.mode : null;
		const changesets: PendingChangeset[] = plan.changesets.map((cs) => ({
			id: cs.id,
			summary: cs.summary,
			releases: cs.releases.filter((r) => r.type !== "none").map((r) => ({ name: r.name, type: r.type as BumpType })),
		}));
		const releasesToRender = plan.releases.filter((r) => r.type !== "none");
		if (releasesToRender.length === 0) {
			return { preMode, releases: [], changesets };
		}

		const tempRoot = yield* fs.makeTempDirectoryScoped({ prefix: "silk-preview-" });

		const mapDir = (dir: string): Effect.Effect<string, ReleasePlanError> => {
			const rel = relative(packages.rootDir, dir);
			// Guard the non-destructive invariant: a package dir outside the
			// workspace root would make `relative` yield `..`/an absolute path and
			// `join` escape `tempRoot`. Refuse rather than write outside temp.
			if (rel.startsWith("..") || isAbsolute(rel)) {
				return Effect.fail(
					new ReleasePlanError({
						phase: "preview",
						reason: `Package directory is outside the workspace root: ${dir}`,
					}),
				);
			}
			return Effect.succeed(join(tempRoot, rel));
		};

		const tempDirs = yield* Effect.forEach(packages.packages, (p) => mapDir(p.dir));
		const tempPackages: Packages = {
			tool: packages.tool,
			rootDir: tempRoot,
			rootPackage: { dir: tempRoot, packageJson: structuredClone(rootPackage.packageJson) },
			packages: packages.packages.map((p, i) => ({
				dir: tempDirs[i],
				packageJson: structuredClone(p.packageJson),
			})),
		};

		// scaffold temp dirs + seed package.json + existing CHANGELOGs and pre.json
		yield* fs.makeDirectory(join(tempRoot, ".changeset"), { recursive: true });
		yield* fs.copyFile(join(root, "package.json"), join(tempRoot, "package.json"));
		const preJson = join(root, ".changeset", "pre.json");
		const preJsonExists = yield* fs.exists(preJson);
		if (preJsonExists) yield* fs.copyFile(preJson, join(tempRoot, ".changeset", "pre.json"));
		for (let i = 0; i < packages.packages.length; i++) {
			const p = packages.packages[i];
			const tDir = tempDirs[i];
			yield* fs.makeDirectory(tDir, { recursive: true });
			yield* fs.copyFile(join(p.dir, "package.json"), join(tDir, "package.json"));
			const realCl = join(p.dir, "CHANGELOG.md");
			const realClExists = yield* fs.exists(realCl);
			if (realClExists) yield* fs.copyFile(realCl, join(tDir, "CHANGELOG.md"));
		}
		const rootCl = join(packages.rootDir, "CHANGELOG.md");
		const rootClExists = yield* fs.exists(rootCl);
		if (rootClExists) yield* fs.copyFile(rootCl, join(tempRoot, "CHANGELOG.md"));

		// run the GENUINE engine; contextDir = real root so config.changelog resolves
		yield* Effect.tryPromise({
			try: () => applyReleasePlan(plan, tempPackages, config, undefined, root),
			catch: (e) => new ReleasePlanError({ phase: "preview", reason: errMsg(e) }),
		});

		const dirByName = new Map<string, string>();
		for (const p of tempPackages.packages) dirByName.set(p.packageJson.name, p.dir);
		if (tempPackages.rootPackage?.packageJson.name) {
			dirByName.set(tempPackages.rootPackage.packageJson.name, tempRoot);
		}

		const releases: PreviewRelease[] = [];
		for (const r of releasesToRender) {
			const dir = dirByName.get(r.name);
			if (!dir) continue;
			const clPath = join(dir, "CHANGELOG.md");
			const clExists = yield* fs.exists(clPath);
			if (!clExists) continue;
			// Sync engine call: a throw here must stay on the typed failure path
			// rather than escaping the gen body as a defect.
			const reason = reasonByName.get(r.name);
			yield* Effect.try({
				try: () =>
					ChangelogTransformer.transformFile(
						clPath,
						reason ? { maintenance: { version: r.newVersion, reason } } : undefined,
					),
				catch: (e) => new ReleasePlanError({ phase: "preview", reason: errMsg(e) }),
			});
			const content = yield* fs.readFileString(clPath);
			releases.push({
				name: r.name,
				type: r.type as BumpType,
				oldVersion: r.oldVersion,
				newVersion: r.newVersion,
				changesetIds: [...r.changesets],
				changelogEntry: extractVersionBlock(content, r.newVersion),
			});
		}
		return { preMode, releases, changesets };
	});

	return Effect.scoped(program).pipe(
		Effect.mapError((e) =>
			e instanceof ReleasePlanError ? e : new ReleasePlanError({ phase: "preview", reason: errMsg(e) }),
		),
	);
}

/** Re-read a package's version from disk (post-bump) to feed versionFiles; unreadable/unparseable falls back. */
function diskVersion(workspaceDir: string, fallback: string, fs: FileSystem.FileSystem): Effect.Effect<string> {
	return fs.readFileString(join(workspaceDir, "package.json")).pipe(
		Effect.flatMap((raw) => Effect.try(() => (JSON.parse(raw) as { version?: string }).version ?? fallback)),
		Effect.orElseSucceed(() => fallback),
	);
}

function applyEffect(
	root: string,
	dryRun: boolean,
	changelogModules: Readonly<Record<string, string>> | undefined,
	inspector: ConfigInspectorShape,
	fs: FileSystem.FileSystem,
): Effect.Effect<AppliedRelease, ReleasePlanError> {
	return Effect.gen(function* () {
		// v3 `readPreState` (invoked internally by `getReleasePlan`) rewrites a
		// legacy `pre.json` in place as an auto-migration — acceptable, but it
		// means even this read-only `plan` computation can touch disk when
		// `pre.json` is stale.
		const { plan, packages, config, warnings } = yield* Effect.tryPromise({
			try: async () => {
				const [plan, packages] = await Promise.all([getReleasePlan(root), getPackages(root)]);
				const { config, warnings } = await loadConfig(root, packages);
				return { plan, packages, config, warnings };
			},
			catch: (e) => new ReleasePlanError({ phase: "apply", reason: errMsg(e) }),
		});
		yield* Effect.forEach(warnings, (w) => Effect.logWarning(w));

		let engineConfig: Config = config;
		if (changelogModules) {
			engineConfig = { ...config, format: false };
			if (Array.isArray(config.changelog)) {
				const configuredId = config.changelog[0];
				const mapped = changelogModules[configuredId];
				if (mapped === undefined) {
					const supported = Object.keys(changelogModules).join(", ");
					return yield* Effect.fail(
						new ReleasePlanError({
							phase: "apply",
							reason: `changelog id "${configuredId}" is not in changelogModules (supported: ${supported})`,
						}),
					);
				}
				engineConfig = { ...engineConfig, changelog: [mapped, config.changelog[1]] };
			}
		}

		const releases = plan.releases
			.filter((r) => r.type !== "none")
			.map((r) => ({ name: r.name, type: r.type as BumpType, oldVersion: r.oldVersion, newVersion: r.newVersion }));

		let touchedFiles: string[] = [];
		if (!dryRun) {
			const reasonByName = maintenanceReasons(plan, config);
			const versionByPkgName = new Map(plan.releases.map((r) => [r.name, r.newVersion]));
			const nameByDir = new Map<string, string>();
			for (const p of packages.packages) nameByDir.set(p.dir, p.packageJson.name);
			if (packages.rootPackage?.packageJson.name) {
				nameByDir.set(packages.rootDir, packages.rootPackage.packageJson.name);
			}
			touchedFiles = yield* Effect.tryPromise({
				try: async () => {
					const touched = await applyReleasePlan(plan, packages, engineConfig);
					for (const f of touched) {
						if (!f.endsWith("CHANGELOG.md")) continue;
						const pkgName = nameByDir.get(dirname(f));
						const reason = pkgName ? reasonByName.get(pkgName) : undefined;
						const newVersion = pkgName ? versionByPkgName.get(pkgName) : undefined;
						ChangelogTransformer.transformFile(
							f,
							reason && newVersion ? { maintenance: { version: newVersion, reason } } : undefined,
						);
					}
					return touched;
				},
				catch: (e) => new ReleasePlanError({ phase: "apply", reason: errMsg(e) }),
			});
		}

		// versionFiles via the resolved config inspector. A missing/invalid config
		// (inspect failing) degrades gracefully to no updates, logged so it stays
		// visible. A genuine versionFile write failure is surfaced as a typed error
		// rather than thrown inside `Effect.map` — where it would become an uncaught
		// defect and crash `apply()`.
		const newVersionByName = new Map(plan.releases.map((r) => [r.name, r.newVersion]));
		const inspected = yield* inspector
			.inspect(root)
			.pipe(
				Effect.catch((error) =>
					Effect.logWarning(`Skipping versionFiles update: ${errMsg(error)}`).pipe(Effect.as(null)),
				),
			);
		let versionFileUpdates: Array<{ filePath: string; version: string }> = [];
		if (inspected) {
			const candidates = inspected.packages.filter((p) => p.versionFiles.length > 0);
			const freshVersions = yield* Effect.forEach(candidates, (p) =>
				dryRun ? Effect.succeed(newVersionByName.get(p.name) ?? p.version) : diskVersion(p.workspaceDir, p.version, fs),
			);
			const scopes = candidates.map((p, i) => {
				const fresh = freshVersions[i];
				return fresh !== p.version ? { ...p, version: fresh } : p;
			});
			versionFileUpdates = yield* Effect.try({
				try: () => (scopes.length > 0 ? VersionFiles.processResolvedVersionFiles(scopes, dryRun) : []),
				catch: (e) => new ReleasePlanError({ phase: "apply", reason: errMsg(e) }),
			});
		}

		return { dryRun, touchedFiles, releases, versionFileUpdates };
	});
}
