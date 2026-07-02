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

import { isAbsolute, join, relative } from "node:path";
import applyReleasePlan from "@changesets/apply-release-plan";
import { read as readChangesetConfig } from "@changesets/config";
import getReleasePlan from "@changesets/get-release-plan";
import type { ReleasePlan } from "@changesets/types";
import { FileSystem } from "@effect/platform";
import { getPackages } from "@manypkg/get-packages";
import { Context, Effect, Layer } from "effect";
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

/**
 * The v1 `Packages` shape the changesets engine consumes (its own transitive
 * `@manypkg/get-packages@1.x`), derived from the engine's signature so it
 * tracks whatever shape changesets expects if it ever upgrades.
 */
type ChangesetsPackages = Parameters<typeof applyReleasePlan>[1];

const V1_TOOLS = new Set(["yarn", "bolt", "pnpm", "lerna", "root"]);

/**
 * Single workspace-discovery seam; swap to an Effect-native stack later here.
 *
 * Discovers with `@manypkg/get-packages@3.x` and adapts to the v1 shape:
 * `tool` collapses to its type string (tools unknown to v1 map to `"root"` —
 * the engine never reads `tool` at runtime, only `root.dir`), and
 * `rootDir`/`rootPackage` fold back into `root`.
 */
const buildPackages = async (root: string): Promise<ChangesetsPackages> => {
	const { tool, rootDir, rootPackage, packages } = await getPackages(root);
	if (!rootPackage) throw new Error(`Workspace root has no package.json: ${rootDir}`);
	return {
		tool: (V1_TOOLS.has(tool.type) ? tool.type : "root") as ChangesetsPackages["tool"],
		root: { dir: rootPackage.dir, packageJson: rootPackage.packageJson },
		packages: packages.map((p) => ({ dir: p.dir, packageJson: p.packageJson })),
	};
};

const errMsg = (e: unknown): string => (e instanceof Error ? e.message : String(e));

/** The `ReleasePlanner` service surface. @public */
export interface ReleasePlannerShape {
	/** Compute the in-memory release plan (read-only). */
	readonly plan: (root: string) => Effect.Effect<ReleasePlan, ReleasePlanError>;
	/** Render a non-destructive preview of the next release. */
	readonly preview: (root: string) => Effect.Effect<ChangesetPreview, ReleasePlanError>;
	/** Natively apply the release (destructive unless `dryRun`). */
	readonly apply: (
		root: string,
		options?: { readonly dryRun?: boolean },
	) => Effect.Effect<AppliedRelease, ReleasePlanError>;
}

const _tag = Context.Tag("ReleasePlanner");

/**
 * Base class for {@link ReleasePlanner}.
 *
 * @privateRemarks Required export for api-extractor (anonymous Context.Tag base). Do not delete.
 * @internal
 */
export const ReleasePlannerBase = _tag<ReleasePlanner, ReleasePlannerShape>();

/** Effect service tag for the release planner. @public */
export class ReleasePlanner extends ReleasePlannerBase {}

/** Build the service shape over a resolved {@link ConfigInspector} and {@link FileSystem.FileSystem}. */
function makeShape(inspector: ConfigInspectorShape, fs: FileSystem.FileSystem): ReleasePlannerShape {
	const plan: ReleasePlannerShape["plan"] = (root) =>
		Effect.tryPromise({
			try: () => getReleasePlan(root),
			catch: (e) => new ReleasePlanError({ phase: "plan", reason: errMsg(e) }),
		});

	const preview: ReleasePlannerShape["preview"] = (root) => previewEffect(root, fs);

	const apply: ReleasePlannerShape["apply"] = (root, options) =>
		applyEffect(root, options?.dryRun ?? false, inspector, fs);

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

/**
 * Render a non-destructive preview by redirecting every write into a
 * scope-managed temp directory (cleaned up automatically when the scope
 * closes) and reading the generated CHANGELOG blocks back.
 */
function previewEffect(root: string, fs: FileSystem.FileSystem): Effect.Effect<ChangesetPreview, ReleasePlanError> {
	const program = Effect.gen(function* () {
		const [plan, packages] = yield* Effect.tryPromise({
			try: () => Promise.all([getReleasePlan(root), buildPackages(root)]),
			catch: (e) => new ReleasePlanError({ phase: "preview", reason: errMsg(e) }),
		});
		const config = yield* Effect.tryPromise({
			try: () => readChangesetConfig(root, packages),
			catch: (e) => new ReleasePlanError({ phase: "preview", reason: errMsg(e) }),
		});

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
			const rel = relative(packages.root.dir, dir);
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
		const tempPackages: ChangesetsPackages = {
			tool: packages.tool,
			root: { ...packages.root, dir: tempRoot, packageJson: structuredClone(packages.root.packageJson) },
			packages: packages.packages.map((p, i) => ({
				...p,
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
		const rootCl = join(packages.root.dir, "CHANGELOG.md");
		const rootClExists = yield* fs.exists(rootCl);
		if (rootClExists) yield* fs.copyFile(rootCl, join(tempRoot, "CHANGELOG.md"));

		// run the GENUINE engine; contextDir = real root so config.changelog resolves
		yield* Effect.tryPromise({
			try: () => applyReleasePlan(plan, tempPackages, config, undefined, root),
			catch: (e) => new ReleasePlanError({ phase: "preview", reason: errMsg(e) }),
		});

		const dirByName = new Map<string, string>();
		for (const p of tempPackages.packages) dirByName.set(p.packageJson.name, p.dir);
		if (tempPackages.root.packageJson.name) dirByName.set(tempPackages.root.packageJson.name, tempRoot);

		const releases: PreviewRelease[] = [];
		for (const r of releasesToRender) {
			const dir = dirByName.get(r.name);
			if (!dir) continue;
			const clPath = join(dir, "CHANGELOG.md");
			const clExists = yield* fs.exists(clPath);
			if (!clExists) continue;
			// Sync engine call: a throw here must stay on the typed failure path
			// rather than escaping the gen body as a defect.
			yield* Effect.try({
				try: () => ChangelogTransformer.transformFile(clPath),
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
	inspector: ConfigInspectorShape,
	fs: FileSystem.FileSystem,
): Effect.Effect<AppliedRelease, ReleasePlanError> {
	return Effect.gen(function* () {
		const { plan, packages, config } = yield* Effect.tryPromise({
			try: async () => {
				const [plan, packages] = await Promise.all([getReleasePlan(root), buildPackages(root)]);
				const config = await readChangesetConfig(root, packages);
				return { plan, packages, config };
			},
			catch: (e) => new ReleasePlanError({ phase: "apply", reason: errMsg(e) }),
		});

		const releases = plan.releases
			.filter((r) => r.type !== "none")
			.map((r) => ({ name: r.name, type: r.type as BumpType, oldVersion: r.oldVersion, newVersion: r.newVersion }));

		let touchedFiles: string[] = [];
		if (!dryRun) {
			touchedFiles = yield* Effect.tryPromise({
				try: async () => {
					const touched = await applyReleasePlan(plan, packages, config);
					for (const f of touched) {
						if (f.endsWith("CHANGELOG.md")) ChangelogTransformer.transformFile(f);
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
				Effect.catchAll((error) =>
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
