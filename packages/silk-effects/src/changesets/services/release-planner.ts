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
 * @packageDocumentation
 */

import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import applyReleasePlan from "@changesets/apply-release-plan";
import { read as readChangesetConfig } from "@changesets/config";
import getReleasePlan from "@changesets/get-release-plan";
import type { ReleasePlan } from "@changesets/types";
import type { Packages } from "@manypkg/get-packages";
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

/** Single workspace-discovery seam; swap to an Effect-native stack later here. */
const buildPackages = (root: string): Promise<Packages> => getPackages(root);

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

/** Build the service shape over a resolved {@link ConfigInspector}. */
function makeShape(inspector: ConfigInspectorShape): ReleasePlannerShape {
	const plan: ReleasePlannerShape["plan"] = (root) =>
		Effect.tryPromise({
			try: () => getReleasePlan(root),
			catch: (e) => new ReleasePlanError({ phase: "plan", reason: errMsg(e) }),
		});

	// preview + apply implemented in later tasks.
	const preview: ReleasePlannerShape["preview"] = (root) =>
		Effect.tryPromise({
			try: () => previewImpl(root),
			catch: (e) => new ReleasePlanError({ phase: "preview", reason: errMsg(e) }),
		});

	const apply: ReleasePlannerShape["apply"] = (root, options) => applyEffect(root, options?.dryRun ?? false, inspector);

	return { plan, preview, apply };
}

/** Production layer. Requires {@link ConfigInspector} (used by `apply`). @public */
export const ReleasePlannerLive: Layer.Layer<ReleasePlanner, never, ConfigInspector> = Layer.effect(
	ReleasePlanner,
	Effect.gen(function* () {
		const inspector = yield* ConfigInspector;
		return makeShape(inspector);
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

async function previewImpl(root: string): Promise<ChangesetPreview> {
	const [plan, packages] = await Promise.all([getReleasePlan(root), buildPackages(root)]);
	const config = await readChangesetConfig(root, packages);

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

	const tempRoot = mkdtempSync(join(tmpdir(), "silk-preview-"));
	try {
		const mapDir = (dir: string) => join(tempRoot, relative(packages.root.dir, dir));
		const tempPackages: Packages = {
			tool: packages.tool,
			root: { ...packages.root, dir: tempRoot, packageJson: structuredClone(packages.root.packageJson) },
			packages: packages.packages.map((p) => ({
				...p,
				dir: mapDir(p.dir),
				packageJson: structuredClone(p.packageJson),
			})),
		};

		// scaffold temp dirs + seed package.json + existing CHANGELOGs and pre.json
		mkdirSync(join(tempRoot, ".changeset"), { recursive: true });
		cpSync(join(root, "package.json"), join(tempRoot, "package.json"));
		const preJson = join(root, ".changeset", "pre.json");
		if (existsSync(preJson)) cpSync(preJson, join(tempRoot, ".changeset", "pre.json"));
		for (const p of packages.packages) {
			const tDir = mapDir(p.dir);
			mkdirSync(tDir, { recursive: true });
			cpSync(join(p.dir, "package.json"), join(tDir, "package.json"));
			const realCl = join(p.dir, "CHANGELOG.md");
			if (existsSync(realCl)) cpSync(realCl, join(tDir, "CHANGELOG.md"));
		}
		const rootCl = join(packages.root.dir, "CHANGELOG.md");
		if (existsSync(rootCl)) cpSync(rootCl, join(tempRoot, "CHANGELOG.md"));

		// run the GENUINE engine; contextDir = real root so config.changelog resolves
		await applyReleasePlan(plan, tempPackages, config, undefined, root);

		const dirByName = new Map<string, string>();
		for (const p of tempPackages.packages) dirByName.set(p.packageJson.name, p.dir);
		if (tempPackages.root.packageJson.name) dirByName.set(tempPackages.root.packageJson.name, tempRoot);

		const releases: PreviewRelease[] = [];
		for (const r of releasesToRender) {
			const dir = dirByName.get(r.name);
			if (!dir) continue;
			const clPath = join(dir, "CHANGELOG.md");
			if (!existsSync(clPath)) continue;
			ChangelogTransformer.transformFile(clPath);
			const content = readFileSync(clPath, "utf-8");
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
	} finally {
		rmSync(tempRoot, { recursive: true, force: true });
	}
}
/** Re-read a package's version from disk (post-bump) to feed versionFiles. */
function diskVersion(workspaceDir: string, fallback: string): string {
	try {
		return JSON.parse(readFileSync(join(workspaceDir, "package.json"), "utf-8")).version ?? fallback;
	} catch {
		return fallback;
	}
}

function applyEffect(
	root: string,
	dryRun: boolean,
	inspector: ConfigInspectorShape,
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

		// versionFiles via the resolved config inspector (skips silently if no config)
		const newVersionByName = new Map(plan.releases.map((r) => [r.name, r.newVersion]));
		const versionFileUpdates = yield* inspector.inspect(root).pipe(
			Effect.map((inspected) => {
				const scopes = inspected.packages
					.filter((p) => p.versionFiles.length > 0)
					.map((p) => {
						const fresh = dryRun ? (newVersionByName.get(p.name) ?? p.version) : diskVersion(p.workspaceDir, p.version);
						return fresh !== p.version ? { ...p, version: fresh } : p;
					});
				return scopes.length > 0 ? VersionFiles.processResolvedVersionFiles(scopes, dryRun) : [];
			}),
			Effect.catchAll(() => Effect.succeed([] as Array<{ filePath: string; version: string }>)),
		);

		return { dryRun, touchedFiles, releases, versionFileUpdates };
	});
}
