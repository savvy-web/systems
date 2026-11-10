/**
 * `ReleasePlanner` service — compute a release plan, render a read-only
 * preview, or natively apply a release, over `\@effected/changesets`.
 *
 * @remarks
 * The kit plans and computes; this service does the IO. `ReleasePlan.readWithContext`
 * plans the workspace containing the given directory from its root's config,
 * pending changesets and `pre.json`; `ReleasePlan.edits` computes everything `changeset
 * version` writes as data; `Changelog.entry` renders each release's block
 * through the changelog module this service loads. `preview` computes and
 * renders without writing anything; `apply` computes, then writes.
 *
 */

import { join } from "node:path";
import { pathToFileURL } from "node:url";
import type {
	ChangelogFunctions,
	ManifestEdit,
	PendingChangeset,
	PlannedRelease,
	ReleaseEdits,
	ReleaseSnapshot,
} from "@effected/changesets";
import { Changelog, ChangesetConfig, ReleasePlan } from "@effected/changesets";
import { Git } from "@effected/git";
import { JsoncEdit, JsoncFormattingOptions, JsoncModifier } from "@effected/jsonc";
import type { WorkspacePackage } from "@effected/workspaces";
import { WorkspaceDiscovery } from "@effected/workspaces";
import { Clock, Context, Data, Effect, FileSystem, Layer, Option, Path, Result } from "effect";
import { resolve as resolveImport } from "import-meta-resolve";
import { ChangelogTransformer } from "../api/transformer.js";
import { ReleasePlanError } from "../errors.js";
import type {
	AppliedRelease,
	AppliedReleaseEntry,
	BumpType,
	ChangesetPreview,
	PendingChangeset as PreviewChangeset,
	PreviewRelease,
	VersionFileUpdateRecord,
} from "../schemas/release-plan.js";
import { VersionFiles } from "../utils/version-files.js";
import type { ConfigInspectorShape } from "./config-inspector.js";
import { ConfigInspector } from "./config-inspector.js";
import type { MaintenanceReason } from "./maintenance-reason.js";
import { deriveMaintenanceReason } from "./maintenance-reason.js";

type Phase = "plan" | "preview" | "apply";

const errMsg = (e: unknown): string => (e instanceof Error ? e.message : String(e));

/**
 * Per-call `changeset version --snapshot` parity options, forwarded to
 * `\@effected/changesets`' `ReleasePlan.readWithContext` as its snapshot input.
 * Mirrors the CLI's `--snapshot [tag]` flag plus its
 * `--snapshot-prerelease-template` override.
 *
 * @remarks
 * It is a typed `ReleasePlanError` (not a defect) when: the workspace is in
 * `pre` mode (CLI parity — snapshot releases are refused there), or the
 * resolved `prereleaseTemplate` references a placeholder with no value (e.g.
 * `{commit}` with no `commit` supplied, or a template omitting `{tag}` while a
 * `tag` is given). The `{timestamp}`/`{datetime}` placeholders are taken from
 * the Effect `Clock` at the moment of the call.
 *
 * @public
 */
export interface SnapshotOptions {
	/**
	 * The snapshot tag, e.g. `"next"` — like the bare `changeset version
	 * --snapshot <tag>` argument. Omit it or pass `""` for the bare `--snapshot`
	 * flag (an empty tag is no tag, and dependents are still exact-pinned); no
	 * boundary validation is performed here (a caller-side check for reserved
	 * values like `"latest"` or `""` is the caller's responsibility).
	 */
	readonly tag?: string;
	/** Per-call override of `config.snapshot.useCalculatedVersion`. */
	readonly useCalculatedVersion?: boolean;
	/** Per-call override of `config.snapshot.prereleaseTemplate`. */
	readonly prereleaseTemplate?: string;
	/**
	 * Value substituted for the `{commit}`/`{commit-short}` prerelease-template
	 * placeholders. This service never shells out to git to compute one —
	 * callers that want commit-scoped snapshots must supply it themselves.
	 */
	readonly commit?: string;
}

/**
 * One completed phase of a non-dry {@link ReleasePlannerShape.apply}, reported
 * to {@link ApplyOptions.onStep} as it lands.
 *
 * @remarks
 * `EngineApplied` fires once the release edits have landed: versions bumped,
 * dependency ranges rewritten, CHANGELOGs written and transformed, and
 * consumed changesets deleted (or, in pre mode, moved under
 * `.changeset/pre/`).
 * `VersionFilesUpdated` fires after the versionFiles phase, only when it
 * updated at least one file. A `dryRun` writes nothing and reports no steps.
 *
 * @public
 */
export type ApplyStep = Data.TaggedEnum<{
	/** The release edits landed: `touchedFiles` were written for `releases`. */
	readonly EngineApplied: {
		readonly touchedFiles: ReadonlyArray<string>;
		readonly releases: ReadonlyArray<AppliedReleaseEntry>;
	};
	/** The versionFiles phase wrote `updates`. */
	readonly VersionFilesUpdated: { readonly updates: ReadonlyArray<VersionFileUpdateRecord> };
}>;

const ApplyStep = Data.taggedEnum<ApplyStep>();

/**
 * Options for {@link ReleasePlannerShape.apply}.
 *
 * @typeParam R - Services the `onStep` callback requires.
 *
 * @public
 */
export interface ApplyOptions<R = never> {
	/** Compute and report the release without writing anything. */
	readonly dryRun?: boolean;
	/**
	 * Map configured changelog ids to absolute module paths. When set, the
	 * configured id (a bare `changelog` string, or a pair's first element) must
	 * be a key of this map and the mapped path is loaded instead; an unmapped
	 * id fails typed. For no-`node_modules` contexts, where the id cannot be
	 * resolved. No formatter is ever run over the CHANGELOG either way.
	 */
	readonly changelogModules?: Readonly<Record<string, string>>;
	/** `changeset version --snapshot` parity. See {@link SnapshotOptions}. */
	readonly snapshot?: SnapshotOptions;
	/**
	 * Called after each completed phase, in order, before the next one starts —
	 * so a caller can report what already reached disk even if a later phase
	 * fails. Never called on a `dryRun`.
	 */
	readonly onStep?: (step: ApplyStep) => Effect.Effect<void, never, R>;
}

/** The `ReleasePlanner` service surface. @public */
export interface ReleasePlannerShape {
	/**
	 * Compute the in-memory release plan (read-only): `\@effected/changesets`'
	 * `ReleasePlan`. `root` may be the workspace root or any directory inside it.
	 */
	readonly plan: (root: string) => Effect.Effect<ReleasePlan, ReleasePlanError>;
	/**
	 * Render a non-destructive preview of the next release.
	 *
	 * @remarks
	 * Rendering `changelogEntry` means resolving the configured changelog module,
	 * so `changelogModules` matters here for the same reason it does on `apply`.
	 */
	readonly preview: (
		root: string,
		options?: {
			/**
			 * Map configured changelog ids to absolute module paths. When set, the
			 * configured id (a bare `changelog` string, or a pair's first element) must
			 * be a key of this map and the mapped path is loaded instead; an unmapped
			 * id fails typed. For no-`node_modules` contexts, where the id cannot be
			 * resolved. No formatter is ever run over the CHANGELOG either way.
			 */
			readonly changelogModules?: Readonly<Record<string, string>>;
			/** `changeset version --snapshot` parity. See {@link SnapshotOptions}. */
			readonly snapshot?: SnapshotOptions;
		},
	) => Effect.Effect<ChangesetPreview, ReleasePlanError>;
	/** Natively apply the release (destructive unless `dryRun`). See {@link ApplyOptions}. */
	readonly apply: <R = never>(
		root: string,
		options?: ApplyOptions<R>,
	) => Effect.Effect<AppliedRelease, ReleasePlanError, R>;
}

/** Effect service tag for the release planner. @public */
export class ReleasePlanner extends Context.Service<ReleasePlanner, ReleasePlannerShape>()("ReleasePlanner") {
	/**
	 * Production layer. Requires {@link ConfigInspector} (used by `apply`), the
	 * platform `FileSystem` and `Path`, `\@effected/workspaces`'
	 * `WorkspaceDiscovery` (each call lists the packages of the workspace it is
	 * given, refreshed first), and `\@effected/git`'s `Git` (the commit that
	 * added each changeset, for the changelog module).
	 *
	 * @public
	 */
	static readonly layer: Layer.Layer<
		ReleasePlanner,
		never,
		ConfigInspector | FileSystem.FileSystem | Path.Path | WorkspaceDiscovery | Git
	> = Layer.effect(
		this,
		Effect.gen(function* () {
			const deps: Deps = {
				inspector: yield* ConfigInspector,
				fs: yield* FileSystem.FileSystem,
				path: yield* Path.Path,
				discovery: yield* WorkspaceDiscovery,
				git: yield* Git,
			};
			return makeShape(deps);
		}),
	);
}

/** The services one built planner holds. */
interface Deps {
	readonly inspector: ConfigInspectorShape;
	readonly fs: FileSystem.FileSystem;
	readonly path: Path.Path;
	readonly discovery: WorkspaceDiscovery["Service"];
	readonly git: Git["Service"];
}

/** Build the service shape over its resolved dependencies. */
function makeShape(deps: Deps): ReleasePlannerShape {
	const plan: ReleasePlannerShape["plan"] = (root) =>
		readPlan(deps, root, "plan", undefined).pipe(Effect.map((read) => read.plan));

	const preview: ReleasePlannerShape["preview"] = (root, options) =>
		previewEffect(deps, root, options?.changelogModules, options?.snapshot);

	const apply: ReleasePlannerShape["apply"] = (root, options) =>
		applyEffect(deps, root, options?.dryRun ?? false, options?.changelogModules, options?.snapshot, options?.onStep);

	return { plan, preview, apply };
}

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
	const fail = (phase: Phase) => Effect.fail(new ReleasePlanError({ phase, reason: "not provided in test layer" }));
	const shape: ReleasePlannerShape = {
		plan: () => (fixed.plan ? Effect.succeed(fixed.plan) : fail("plan")),
		preview: () => (fixed.preview ? Effect.succeed(fixed.preview) : fail("preview")),
		apply: () => (fixed.apply ? Effect.succeed(fixed.apply) : fail("apply")),
	};
	return Layer.succeed(ReleasePlanner, shape);
}

/** The configured changelog module id and its options, or `undefined` for `changelog: false`. */
function changelogSpec(config: ChangesetConfig): { readonly id: string; readonly options: unknown } | undefined {
	const changelog = config.changelog;
	if (changelog === false) return undefined;
	return typeof changelog === "string" ? { id: changelog, options: null } : { id: changelog[0], options: changelog[1] };
}

/**
 * Rewrite the config for a caller that supplies its own changelog module
 * paths: the configured id becomes its mapped absolute path, as a
 * `[path, options]` pair (a bare id has `null` options, as
 * `\@changesets/config` normalises it).
 *
 * @remarks
 * Shared by `preview` and `apply` — both are called from no-`node_modules`
 * contexts where the configured id cannot be resolved. An unmapped id fails
 * typed (naming the supported keys) rather than reaching the resolver.
 *
 * Exported for tests only — not re-exported from the package index, so it is
 * not public API.
 *
 * @internal
 */
export function withChangelogModules(
	config: ChangesetConfig,
	changelogModules: Readonly<Record<string, string>>,
	phase: "preview" | "apply",
): Effect.Effect<ChangesetConfig, ReleasePlanError> {
	const spec = changelogSpec(config);
	if (spec === undefined) return Effect.succeed(config);
	// Own-property check, not `map[id] === undefined`: an id naming an
	// `Object.prototype` member (`toString`, `constructor`) otherwise reads back
	// an inherited function, skips this typed error and hands the loader a
	// non-string where it expects a module specifier.
	if (!Object.hasOwn(changelogModules, spec.id)) {
		const supported = Object.keys(changelogModules).join(", ");
		return Effect.fail(
			new ReleasePlanError({
				phase,
				reason: `changelog id "${spec.id}" is not in changelogModules (supported: ${supported})`,
			}),
		);
	}
	return Effect.succeed(ChangesetConfig.make({ ...config, changelog: [changelogModules[spec.id], spec.options] }));
}

/**
 * Extract the `## <version>` block (down to the next H2 or EOF) from a changelog.
 *
 * @internal
 */
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
 * Read the `thanks` changelog option from the changesets config pair
 * (`"changelog": ["@savvy-web/changelog", { "thanks": false }]`), if set.
 * A missing or non-boolean value returns `undefined` so the transformer's
 * default (`true`) applies.
 */
function thanksOption(config: ChangesetConfig): boolean | undefined {
	const opts = changelogSpec(config)?.options;
	if (typeof opts !== "object" || opts === null) return undefined;
	const thanks = (opts as { thanks?: unknown }).thanks;
	return typeof thanks === "boolean" ? thanks : undefined;
}

/** Maintenance reasons for every changeset-less release in the plan, keyed by package name. */
function maintenanceReasons(plan: ReleasePlan, config: ChangesetConfig): Map<string, MaintenanceReason> {
	const reasons = new Map<string, MaintenanceReason>();
	for (const r of plan.releases) {
		if (r.type === "none") continue;
		const reason = deriveMaintenanceReason(r, plan, config);
		if (reason) reasons.set(r.name, reason);
	}
	return reasons;
}

/** The workspace one call plans: its root and every package, the root included. */
interface LoadedWorkspace {
	/** The workspace root the kit climbed to, whichever directory inside it the caller named. */
	readonly root: string;
	/** Every package, the workspace root included — what `ReleasePlan.edits` and `Changelog.entry` take. */
	readonly packages: ReadonlyArray<WorkspacePackage>;
}

/** What one read of the workspace yields. */
interface ReadPlan {
	readonly workspace: LoadedWorkspace;
	readonly config: ChangesetConfig;
	readonly plan: ReleasePlan;
}

/** The kit's snapshot input for a call's {@link SnapshotOptions}, timestamped from the `Clock`. */
function kitSnapshot(snapshot: SnapshotOptions): Effect.Effect<ReleaseSnapshot> {
	return Effect.map(Clock.currentTimeMillis, (now) => ({
		tag: snapshot.tag,
		commit: snapshot.commit,
		useCalculatedVersion: snapshot.useCalculatedVersion,
		prereleaseTemplate: snapshot.prereleaseTemplate,
		timestamp: new Date(now),
	}));
}

/** Map a planning failure onto the phase's {@link ReleasePlanError}, keeping this service's pre-mode wording. */
const toPlanError =
	(phase: Phase) =>
	(error: unknown): ReleasePlanError => {
		if (error instanceof ReleasePlanError) return error;
		if (typeof error === "object" && error !== null && (error as { _tag?: unknown })._tag === "SnapshotPreModeError") {
			return new ReleasePlanError({ phase, reason: "Snapshot release is not allowed in pre mode" });
		}
		return new ReleasePlanError({ phase, reason: errMsg(error) });
	};

/**
 * Read the workspace containing `dir` and plan it with
 * `ReleasePlan.readWithContext`, which climbs to the workspace root (or the
 * lone package) and reads the config, pending changesets and `pre.json` there.
 *
 * @remarks
 * `WorkspaceDiscovery` memoizes per root for the layer's lifetime, so a
 * long-lived host (savvy-mcp) would otherwise plan against the manifests of
 * its first call — including the versions an earlier `apply` has since
 * bumped. Each call drops that root's memo first (savvy-web/systems#715).
 */
function readPlan(
	deps: Deps,
	dir: string,
	phase: Phase,
	snapshot: SnapshotOptions | undefined,
): Effect.Effect<ReadPlan, ReleasePlanError> {
	return Effect.gen(function* () {
		yield* deps.discovery.refreshIn(dir).pipe(Effect.ignore);
		const snap = snapshot === undefined ? undefined : yield* kitSnapshot(snapshot);
		const context = yield* ReleasePlan.readWithContext(dir, snap === undefined ? undefined : { snapshot: snap });
		return {
			workspace: { root: context.root, packages: context.packages },
			config: context.config,
			plan: context.plan,
		};
	}).pipe(
		Effect.provideService(FileSystem.FileSystem, deps.fs),
		Effect.provideService(Path.Path, deps.path),
		Effect.provideService(WorkspaceDiscovery, deps.discovery),
		Effect.mapError(toPlanError(phase)),
	);
}

/** `ReleasePlan.edits` for the plan, every workspace package included, failing typed. */
function computeEdits(read: ReadPlan, phase: Phase): Effect.Effect<ReleaseEdits, ReleasePlanError> {
	return Effect.fromResult(
		ReleasePlan.edits(read.plan, { packages: read.workspace.packages, config: read.config }),
	).pipe(Effect.mapError(toPlanError(phase)));
}

/**
 * Load the changelog module the config names: `Option.none()` for
 * `changelog: false`.
 *
 * @remarks
 * Resolution matches `\@changesets/apply-release-plan`: the id is resolved
 * with `import-meta-resolve` from the workspace's `.changeset/` directory,
 * then, failing that, from this module's own location, and the module's
 * default export is unwrapped (twice, for a CJS-wrapped ESM default) to the
 * object holding `getReleaseLine` and `getDependencyReleaseLine`.
 */
function loadChangelogFunctions(
	config: ChangesetConfig,
	root: string,
	phase: Phase,
): Effect.Effect<Option.Option<ChangelogFunctions>, ReleasePlanError> {
	const spec = changelogSpec(config);
	if (spec === undefined) return Effect.succeed(Option.none());
	return Effect.tryPromise({
		try: async () => {
			let url: string;
			try {
				url = resolveImport(spec.id, pathToFileURL(join(root, ".changeset", "x.mjs")).href);
			} catch {
				url = resolveImport(spec.id, import.meta.url);
			}
			let candidate = (await import(url)) as Record<string, unknown>;
			if (candidate.default) {
				candidate = candidate.default as Record<string, unknown>;
				if (candidate.default) candidate = candidate.default as Record<string, unknown>;
			}
			if (typeof candidate.getReleaseLine !== "function" || typeof candidate.getDependencyReleaseLine !== "function") {
				throw new Error(`Could not resolve changelog generation functions from "${spec.id}"`);
			}
			return Option.some(candidate as unknown as ChangelogFunctions);
		},
		catch: (e) => new ReleasePlanError({ phase, reason: errMsg(e) }),
	});
}

/**
 * The commit that added each changeset, keyed by its `file`, as
 * `changeset version` finds them: `Git.commitsThatAdd` over
 * `.changeset/<file>`. A changeset git knows nothing about, a root outside a
 * repository, or a shallow clone whose boundary hides the adding commit gives
 * no entry, so the module gets no `commit` rather than the boundary commit.
 * Only `apply` deepens a shallow clone (as `changeset version` does); a
 * preview never fetches.
 */
function changesetCommits(
	deps: Deps,
	root: string,
	changesets: ReadonlyArray<PendingChangeset>,
	phase: Phase,
): Effect.Effect<ReadonlyMap<string, string>> {
	if (changesets.length === 0) return Effect.succeed(new Map<string, string>());
	return deps.git
		.commitsThatAdd(
			root,
			changesets.map((changeset) => `.changeset/${changeset.file}`),
			phase === "apply" ? { deepen: {} } : undefined,
		)
		.pipe(
			Effect.map((shas) => {
				const found = new Map<string, string>();
				changesets.forEach((changeset, index) => {
					const sha = shas[index];
					if (sha !== undefined && Option.isSome(sha)) found.set(changeset.file, sha.value);
				});
				return found;
			}),
			Effect.orElseSucceed(() => new Map<string, string>()),
		);
}

/**
 * Render every real release's changelog block, before anything is written:
 * `Option.none()` per package when the config has `changelog: false`.
 */
function renderBlocks(
	deps: Deps,
	read: ReadPlan,
	engineConfig: ChangesetConfig,
	phase: Phase,
): Effect.Effect<ReadonlyMap<string, string>, ReleasePlanError> {
	return Effect.gen(function* () {
		const functions = yield* loadChangelogFunctions(engineConfig, read.workspace.root, phase);
		if (Option.isNone(functions)) return new Map<string, string>();
		const commits = yield* changesetCommits(deps, read.workspace.root, read.plan.changesets, phase);
		const rendered = yield* Effect.forEach(
			read.plan.releases.filter((r) => r.type !== "none"),
			(release) =>
				Changelog.entry(read.plan, release, functions.value, {
					packages: read.workspace.packages,
					config: engineConfig,
					commits,
				}).pipe(Effect.map((block) => [release.name, block] as const)),
			{ concurrency: "unbounded" },
		).pipe(Effect.mapError(toPlanError(phase)));
		const blocks = new Map<string, string>();
		for (const [name, block] of rendered) if (Option.isSome(block)) blocks.set(name, block.value);
		return blocks;
	});
}

/** The package a release names, the workspace root included. */
const packageOf = (workspace: LoadedWorkspace, name: string): WorkspacePackage | undefined =>
	workspace.packages.find((pkg) => pkg.name === name);

/** One indentation level and line ending of a JSON document, for text `modify` has to insert. */
function jsonFormatting(content: string): JsoncFormattingOptions {
	const indent = /^([ \t]+)"/m.exec(content)?.[1] ?? "  ";
	const insertSpaces = !indent.includes("\t");
	return JsoncFormattingOptions.make({
		insertSpaces,
		tabSize: insertSpaces ? indent.length : 1,
		eol: content.includes("\r\n") ? "\r\n" : "\n",
	});
}

/**
 * Apply one {@link ManifestEdit} to a `package.json`'s text, format-preserving:
 * each value is replaced in place by `\@effected/jsonc`'s `modify`, never a
 * `JSON.parse`/`JSON.stringify` round-trip.
 */
function editManifest(content: string, edit: ManifestEdit): Result.Result<string, Error> {
	const formattingOptions = jsonFormatting(content);
	const operations: Array<readonly [ReadonlyArray<string>, string]> = [
		...edit.ranges.map((range) => [[range.kind, range.dependency], range.to] as const),
		...(edit.version === undefined ? [] : [[["version"], edit.version] as const]),
	];
	let text = content;
	for (const [path, value] of operations) {
		const edits = JsoncModifier.modifyResult(text, [...path], value, { formattingOptions });
		if (Result.isFailure(edits)) {
			return Result.fail(
				new Error(`Cannot edit ${path.join(".")} in ${edit.packageJsonPath}: ${edits.failure.message}`),
			);
		}
		text = JsoncEdit.applyAll(text, edits.success);
	}
	return Result.succeed(text);
}

/**
 * Render a non-destructive preview: compute the release edits and changelog
 * blocks, insert each block into the package's current CHANGELOG text in
 * memory, transform it, and read the version block back. Nothing is written.
 */
function previewEffect(
	deps: Deps,
	root: string,
	changelogModules: Readonly<Record<string, string>> | undefined,
	snapshot: SnapshotOptions | undefined,
): Effect.Effect<ChangesetPreview, ReleasePlanError> {
	const { fs } = deps;
	return Effect.gen(function* () {
		const read = yield* readPlan(deps, root, "preview", snapshot);
		const { plan, config, workspace } = read;
		const reasonByName = maintenanceReasons(plan, config);
		const engineConfig = changelogModules ? yield* withChangelogModules(config, changelogModules, "preview") : config;

		const preMode: ChangesetPreview["preMode"] = plan.preState ? plan.preState.mode : null;
		const changesets: PreviewChangeset[] = plan.changesets.map((cs) => ({
			id: cs.id,
			summary: cs.summary,
			releases: [...cs.releases]
				.filter(([, type]) => type !== "none")
				.map(([name, type]) => ({ name, type: type as BumpType })),
		}));
		const releasesToRender = plan.releases.filter((r) => r.type !== "none");
		if (releasesToRender.length === 0) {
			return { preMode, releases: [], changesets };
		}

		// The edits are not written, but computing them holds preview to the same
		// refusals as `apply` (a plan naming a package the workspace lacks).
		yield* computeEdits(read, "preview");
		const blocks = yield* renderBlocks(deps, read, engineConfig, "preview");
		const thanks = thanksOption(config);

		const releases: PreviewRelease[] = [];
		for (const r of releasesToRender) {
			const pkg = packageOf(workspace, r.name);
			if (!pkg) continue;
			const clPath = join(pkg.path, "CHANGELOG.md");
			const existing = (yield* fs.exists(clPath)) ? yield* fs.readFileString(clPath) : undefined;
			const block = blocks.get(r.name);
			const content = block === undefined ? existing : Changelog.insert(existing ?? "", block, r.name);
			if (content === undefined) continue;
			const reason = reasonByName.get(r.name);
			// Sync transform: a throw here must stay on the typed failure path
			// rather than escaping the gen body as a defect.
			const transformed = yield* Effect.try({
				try: () =>
					ChangelogTransformer.transformContent(content, {
						...(reason ? { maintenance: { version: r.newVersion, reason } } : {}),
						...(thanks !== undefined ? { thanks } : {}),
					}),
				catch: (e) => new ReleasePlanError({ phase: "preview", reason: errMsg(e) }),
			});
			releases.push({
				name: r.name,
				type: r.type as BumpType,
				oldVersion: r.oldVersion,
				newVersion: r.newVersion,
				changesetIds: [...r.changesets],
				changelogEntry: extractVersionBlock(transformed, r.newVersion),
			});
		}
		return { preMode, releases, changesets };
	}).pipe(
		Effect.mapError((e) =>
			e instanceof ReleasePlanError ? e : new ReleasePlanError({ phase: "preview", reason: errMsg(e) }),
		),
	);
}

/** Re-read a package's version from disk (post-bump) to feed versionFiles; unreadable/unparseable falls back. */
function diskVersion(
	workspaceDir: string,
	fallback: string | undefined,
	fs: FileSystem.FileSystem,
): Effect.Effect<string | undefined> {
	return fs.readFileString(join(workspaceDir, "package.json")).pipe(
		Effect.flatMap((raw) => Effect.try(() => (JSON.parse(raw) as { version?: string }).version ?? fallback)),
		Effect.orElseSucceed(() => fallback),
	);
}

/**
 * Write a computed release to disk, in `\@changesets/apply-release-plan`'s
 * order, returning the touched files in the order touched: `pre.json` when an
 * `exit` release removes it, then per planned release its `package.json` and
 * `CHANGELOG.md`, then the workspace root's `package.json`, then each consumed
 * changeset (both paths of a move into `.changeset/pre/`).
 */
function writeRelease(
	deps: Deps,
	read: ReadPlan,
	edits: ReleaseEdits,
	blocks: ReadonlyMap<string, string>,
): Effect.Effect<
	{ readonly touched: ReadonlyArray<string>; readonly changelogs: ReadonlyArray<readonly [string, PlannedRelease]> },
	Error
> {
	const { fs } = deps;
	const { plan, workspace } = read;
	const changesetDir = join(workspace.root, ".changeset");
	return Effect.gen(function* () {
		const touched: string[] = [];
		const changelogs: Array<readonly [string, PlannedRelease]> = [];

		if (plan.preState !== undefined && edits.preState === undefined) {
			const preJson = join(changesetDir, "pre.json");
			yield* fs.remove(preJson, { force: true });
			touched.push(preJson);
		}

		const writeManifest = (edit: ManifestEdit) =>
			Effect.gen(function* () {
				const content = yield* fs.readFileString(edit.packageJsonPath);
				const updated = yield* Effect.fromResult(editManifest(content, edit));
				yield* fs.writeFileString(edit.packageJsonPath, updated);
				touched.push(edit.packageJsonPath);
			});

		const pending = new Map(edits.manifests.map((edit) => [edit.name, edit]));
		for (const release of plan.releases) {
			const edit = pending.get(release.name);
			if (edit) {
				yield* writeManifest(edit);
				pending.delete(release.name);
			}
			const block = blocks.get(release.name);
			const pkg = packageOf(workspace, release.name);
			if (block !== undefined && pkg) {
				const clPath = join(pkg.path, "CHANGELOG.md");
				const existing = (yield* fs.exists(clPath)) ? yield* fs.readFileString(clPath) : "";
				yield* fs.writeFileString(clPath, Changelog.insert(existing, block, release.name));
				touched.push(clPath);
				changelogs.push([clPath, release]);
			}
		}
		// What is left is the workspace root, whose ranges alone are edited.
		for (const edit of pending.values()) yield* writeManifest(edit);

		if (edits.moveChangesets.length > 0) {
			yield* fs.makeDirectory(join(changesetDir, "pre"), { recursive: true });
		}
		for (const move of edits.moveChangesets) {
			const from = join(changesetDir, move.from);
			if (!(yield* fs.exists(from))) continue;
			const to = join(changesetDir, move.to);
			yield* fs.rename(from, to);
			touched.push(from, to);
		}
		for (const file of edits.deleteChangesets) {
			const target = join(changesetDir, file);
			if (!(yield* fs.exists(target))) continue;
			yield* fs.remove(target, { force: true });
			touched.push(target);
		}
		return { touched, changelogs };
	});
}

function applyEffect<R>(
	deps: Deps,
	root: string,
	dryRun: boolean,
	changelogModules: Readonly<Record<string, string>> | undefined,
	snapshot: SnapshotOptions | undefined,
	onStepOption: ((step: ApplyStep) => Effect.Effect<void, never, R>) | undefined,
): Effect.Effect<AppliedRelease, ReleasePlanError, R> {
	const { fs, inspector } = deps;
	const onStep = onStepOption ?? (() => Effect.void);
	return Effect.gen(function* () {
		const read = yield* readPlan(deps, root, "apply", snapshot);
		const { plan, config } = read;
		const engineConfig = changelogModules ? yield* withChangelogModules(config, changelogModules, "apply") : config;

		const releases = plan.releases
			.filter((r) => r.type !== "none")
			.map((r) => ({ name: r.name, type: r.type as BumpType, oldVersion: r.oldVersion, newVersion: r.newVersion }));

		let touchedFiles: string[] = [];
		if (!dryRun) {
			// Everything is computed before the first write, so a failing
			// changelog module or edit leaves the tree untouched.
			const edits = yield* computeEdits(read, "apply");
			const blocks = yield* renderBlocks(deps, read, engineConfig, "apply");
			const reasonByName = maintenanceReasons(plan, config);
			const thanks = thanksOption(config);
			const written = yield* writeRelease(deps, read, edits, blocks).pipe(
				Effect.mapError((e) => new ReleasePlanError({ phase: "apply", reason: errMsg(e) })),
			);
			for (const [clPath, release] of written.changelogs) {
				const reason = reasonByName.get(release.name);
				yield* Effect.try({
					try: () =>
						ChangelogTransformer.transformFile(clPath, {
							...(reason ? { maintenance: { version: release.newVersion, reason } } : {}),
							...(thanks !== undefined ? { thanks } : {}),
						}),
					catch: (e) => new ReleasePlanError({ phase: "apply", reason: errMsg(e) }),
				});
			}
			touchedFiles = [...written.touched];
			yield* onStep(ApplyStep.EngineApplied({ touchedFiles, releases }));
		}

		// versionFiles via the resolved config inspector. A missing/invalid config
		// (inspect failing) degrades gracefully to no updates, logged so it stays
		// visible. A genuine versionFile write failure is surfaced as a typed error
		// rather than thrown inside `Effect.map` — where it would become an uncaught
		// defect and crash `apply()`.
		const newVersionByName = new Map(plan.releases.map((r) => [r.name, r.newVersion]));
		// ConfigInspector caches per root for the service's lifetime; refresh
		// this root so a long-lived host resolves versionFiles against the
		// config and workspace on disk now, not an earlier call's
		// (savvy-web/systems#715). Invalidate-only; inspect re-reads.
		yield* inspector.refreshIn(root);
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
			// `processResolvedVersionFiles` is an Effect over `FileSystem` now and fails
			// TYPED, so `Effect.mapError` replaces the old `Effect.try` — the conversion
			// to `ReleasePlanError` is still required, not incidental: a defect here
			// would bypass the inspector's catch and crash `apply()`, which is exactly
			// what `__test__/changesets/services__release-planner-apply.test.ts` pins.
			// The service already holds a resolved `fs`, so provide it here and keep
			// this function's `R` at `never`.
			versionFileUpdates =
				scopes.length > 0
					? yield* VersionFiles.processResolvedVersionFiles(scopes, dryRun).pipe(
							Effect.provideService(FileSystem.FileSystem, fs),
							Effect.mapError((e) => new ReleasePlanError({ phase: "apply", reason: errMsg(e) })),
						)
					: [];
		}
		if (!dryRun && versionFileUpdates.length > 0) {
			yield* onStep(ApplyStep.VersionFilesUpdated({ updates: versionFileUpdates }));
		}

		return { dryRun, touchedFiles, releases, versionFileUpdates };
	});
}
