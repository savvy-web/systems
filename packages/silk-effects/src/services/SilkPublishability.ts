import { isAbsolute, join } from "node:path";
import { FileSystem } from "@effect/platform";
import { Effect, Layer } from "effect";
import type { WorkspacePackage } from "workspaces-effect";
import {
	PublishTarget,
	PublishabilityDetector,
	PublishabilityDetectorLive,
	WorkspaceDiscovery,
} from "workspaces-effect";
import { ChangesetConfig } from "./ChangesetConfig.js";

/** A single object-form publish target in the `publishConfig.targets` map (mirrors the bundler's `PublishTargetObject`). */
export interface RawTargetObject {
	/** Registry endpoint. Defaulted for the well-known `npm`/`github` keys. */
	readonly registry?: string;
	/** Name override for this target's own group. Mutually exclusive with `from`. */
	readonly name?: string;
	/** Reuse another target's group bytes. Mutually exclusive with `name`. */
	readonly from?: string;
}

/** A `publishConfig.targets` value: `true` (well-known registry, base name), a string (name override), or an object. */
export type RawTargetValue = true | string | RawTargetObject;

/**
 * The `publishConfig.targets` map, keyed by target id (`npm`, `github`, or a custom key).
 *
 * @remarks
 * This is the bundler's Record-map form. The legacy array form is no longer supported
 * (removed in the 1.0 breaking change) — declare targets as a keyed map and let the
 * bundler emit the {@link TargetsBinding} that silk publishability resolves against.
 */
export type RawPublishTargets = Record<string, RawTargetValue>;

/** Raw `publishConfig` shape (the unschematized fields silk rules consult). */
export interface RawPublishConfig {
	readonly access?: "public" | "restricted";
	readonly registry?: string;
	readonly directory?: string;
	readonly targets?: RawPublishTargets;
}

/** A resolved byte-variant group from the bundler's `dist/prod/targets.json` binding. */
export interface TargetGroupBinding {
	/** Group folder id; the group's bytes live at {@link dir}. */
	readonly id: string;
	/** The `package.json.name` this group's manifest carries. */
	readonly name: string;
	/** The group's pkg output dir, relative to the package root (e.g. `dist/prod/npm/pkg`). */
	readonly dir: string;
}

/** A resolved registry target from the bundler's `dist/prod/targets.json` binding (one per `publishConfig.targets` key). */
export interface TargetBinding {
	/** The `publishConfig.targets` key (`npm`, `github`, …). */
	readonly id: string;
	/** The group id whose bytes this target deploys. */
	readonly group: string;
	/** The resolved name for that group. */
	readonly name: string;
	/** The resolved registry endpoint. */
	readonly registry: string;
}

/**
 * The `dist/prod/targets.json` binding the bundler emits for the release action to consume.
 *
 * @remarks
 * Written by `@savvy-web/bundler`'s `--target prod` build. `groups` is the distinct
 * byte-variant build set; `targets` binds every declared registry target to one group.
 * `npm: true` + `github: true` collapse into one scoped-name group deployed to two
 * registries (one group, two targets).
 */
export interface TargetsBinding {
	readonly groups: ReadonlyArray<TargetGroupBinding>;
	readonly targets: ReadonlyArray<TargetBinding>;
}

/** Raw `package.json` shape consumed by {@link SilkPublishability.detect}. */
export interface RawPackageJson {
	readonly name?: string;
	readonly version?: string;
	readonly private?: boolean;
	readonly publishConfig?: RawPublishConfig;
}

/** A publishable workspace package and the count of its resolved publish targets. */
export interface PublishablePackage {
	readonly name: string;
	readonly version: string;
	readonly path: string;
	readonly targetCount: number;
}

const NPM_DEFAULT = "https://registry.npmjs.org/";

/**
 * Default registry endpoints for the well-known target keys. Kept in sync with the
 * bundler's `resolveTargets` so the pre-build fallback matches what the binding will carry
 * (no trailing slash).
 */
const DEFAULT_REGISTRIES: Record<string, string> = {
	npm: "https://registry.npmjs.org",
	github: "https://npm.pkg.github.com",
};

/**
 * Silk publishability rules over `workspaces-effect`'s {@link PublishTarget}.
 *
 * @remarks
 * In silk mode `private: true` is the norm on workspace `package.json`; publishability is
 * derived from `publishConfig`, with the `private` flag consulted only as a last-resort
 * default. All helpers are static so a consumer sees the full rule surface in one place.
 *
 * @since 0.4.0
 */
export class SilkPublishability {
	/**
	 * Apply silk publishability rules to a raw `package.json` and the bundler's resolved
	 * target binding. Targets-first precedence:
	 *
	 * - A non-empty `publishConfig.targets` map (the bundler's Record-map form) makes the
	 *   package publishable regardless of `private`. With a `binding` (post-prod-build), one
	 *   {@link PublishTarget} is emitted per resolved registry target, its `directory` set to
	 *   the bound group's `dist/prod/<group>/pkg` dir. Without a binding (pre-build), one
	 *   placeholder target is emitted per declared key so publishability and target counts
	 *   are correct; the directory is best-effort and unused until the build writes the
	 *   binding.
	 * - Else `publishConfig.access` → one target at `publishConfig.directory`.
	 * - Else `private !== true` → one default public target.
	 * - Else `[]`.
	 *
	 * @param pkgName - The package's name (the base name for `true`/empty-object targets).
	 * @param raw - The raw `package.json` (silk reads the unschematized `publishConfig`).
	 * @param binding - The parsed `dist/prod/targets.json` binding, or `null` when the prod
	 *   build has not run yet. See {@link readTargetsBinding}.
	 */
	static detect(pkgName: string, raw: RawPackageJson, binding: TargetsBinding | null): ReadonlyArray<PublishTarget> {
		const pc = raw.publishConfig;
		const targets = pc?.targets;

		// Object-form `publishConfig.targets` (the bundler's Record-map). A declared, non-empty
		// map makes the package publishable regardless of `private`. An empty map — or the
		// legacy ARRAY form (no longer supported as of the 1.0 breaking change) — falls through
		// to the access/private branches rather than resolving to zero targets.
		if (targets && typeof targets === "object" && !Array.isArray(targets) && Object.keys(targets).length > 0) {
			const access = pc?.access ?? "public";
			if (binding) {
				// Post-build: the bundler wrote dist/prod/targets.json. One PublishTarget per
				// resolved registry target; its bytes live in the bound group's pkg dir.
				const dirByGroup = new Map(binding.groups.map((g) => [g.id, g.dir]));
				return binding.targets.map(
					(t) =>
						new PublishTarget({
							name: t.name,
							registry: t.registry,
							directory: dirByGroup.get(t.group) ?? `dist/prod/${t.group}/pkg`,
							access,
						}),
				);
			}
			// Pre-build: no binding yet. Emit one placeholder per declared key so publishability
			// and target counts are correct; the directory is best-effort (group collapsing is
			// only known from the binding) and unused until the prod build writes it.
			return Object.keys(targets).map(
				(id) =>
					new PublishTarget({
						name: pkgName,
						registry: DEFAULT_REGISTRIES[id] ?? pc?.registry ?? NPM_DEFAULT,
						directory: `dist/prod/${id}/pkg`,
						access,
					}),
			);
		}

		if (pc && (pc.access === "public" || pc.access === "restricted")) {
			return [
				new PublishTarget({
					name: pkgName,
					registry: pc.registry ?? NPM_DEFAULT,
					directory: pc.directory ?? ".",
					access: pc.access,
				}),
			];
		}

		if (raw.private !== true) {
			return [
				new PublishTarget({
					name: pkgName,
					registry: pc?.registry ?? NPM_DEFAULT,
					directory: pc?.directory ?? ".",
					access: pc?.access ?? "public",
				}),
			];
		}

		return [];
	}

	/**
	 * Resolve a package's publish targets via {@link PublishabilityDetector}, then drop any
	 * whose built `directory` package.json is `private: true`. Returned targets keep the
	 * detector's original (possibly package-relative) `directory`.
	 */
	static resolveTargets(
		pkg: WorkspacePackage,
		root: string,
	): Effect.Effect<ReadonlyArray<PublishTarget>, never, PublishabilityDetector | FileSystem.FileSystem> {
		return Effect.gen(function* () {
			const detector = yield* PublishabilityDetector;
			const fs = yield* FileSystem.FileSystem;
			const targets = yield* detector.detect(pkg, root);
			const kept: PublishTarget[] = [];
			for (const t of targets) {
				const dir = isAbsolute(t.directory) ? t.directory : join(pkg.path, t.directory);
				if (!(yield* isTargetPrivate(fs, dir))) kept.push(t);
			}
			return kept;
		});
	}

	/**
	 * The publishable, non-ignored packages, resolved through the single
	 * {@link PublishabilityDetector} (which already honors changeset ignore in adaptive mode).
	 */
	static listPublishable(
		root: string,
	): Effect.Effect<ReadonlyArray<PublishablePackage>, never, WorkspaceDiscovery | PublishabilityDetector> {
		return Effect.gen(function* () {
			const discovery = yield* WorkspaceDiscovery;
			const detector = yield* PublishabilityDetector;
			// Discovery errors become defects (the `never` error channel): this resolver assumes a
			// healthy workspace. Callers needing to recover from discovery failure should yield
			// `WorkspaceDiscovery` directly rather than wrapping this in `Effect.catchAll`.
			const packages = yield* discovery.listPackages().pipe(Effect.orDie);
			const out: PublishablePackage[] = [];
			for (const pkg of packages) {
				const targets = yield* detector.detect(pkg, root);
				if (targets.length > 0) {
					out.push({ name: pkg.name, version: pkg.version, path: pkg.path, targetCount: targets.length });
				}
			}
			return out;
		});
	}
}

/** True when a built target directory's package.json is `private: true`. Missing/unreadable/malformed → false. */
const isTargetPrivate = (fs: FileSystem.FileSystem, targetDir: string): Effect.Effect<boolean> =>
	fs.readFileString(join(targetDir, "package.json")).pipe(
		Effect.flatMap((content) =>
			Effect.try({
				try: () => (JSON.parse(content) as { private?: boolean }).private === true,
				catch: () => new Error("invalid package.json"),
			}),
		),
		Effect.orElseSucceed(() => false),
	);

/** Read a raw `package.json` from disk via FileSystem; missing/unreadable/malformed → null. */
const readRaw = (fs: FileSystem.FileSystem, packageJsonPath: string): Effect.Effect<RawPackageJson | null> =>
	fs.readFileString(packageJsonPath).pipe(
		Effect.flatMap((content) =>
			Effect.try({
				try: () => JSON.parse(content) as RawPackageJson,
				catch: () => new Error("invalid package.json"),
			}),
		),
		Effect.orElseSucceed(() => null),
	);

/**
 * Read the bundler's `<pkgPath>/dist/prod/targets.json` binding via FileSystem.
 *
 * @remarks
 * Returns `null` when the file is missing/unreadable/malformed — i.e. before the prod build
 * has run. {@link SilkPublishability.detect} falls back to declared-key placeholders in that
 * case. Used by the silk {@link PublishabilityDetector} layers and the workspace analyzer.
 *
 * @param fs - The FileSystem service.
 * @param pkgPath - Absolute path to the package directory.
 * @since 1.0.0
 */
export const readTargetsBinding = (fs: FileSystem.FileSystem, pkgPath: string): Effect.Effect<TargetsBinding | null> =>
	fs.readFileString(join(pkgPath, "dist", "prod", "targets.json")).pipe(
		Effect.flatMap((content) =>
			Effect.try({
				try: () => JSON.parse(content) as TargetsBinding,
				catch: () => new Error("invalid targets.json"),
			}),
		),
		Effect.orElseSucceed(() => null),
	);

/**
 * Override of `workspaces-effect`'s {@link PublishabilityDetector} Tag with pure silk rules.
 *
 * @remarks Requires `FileSystem` (captured at layer build); `detect` reads the raw
 * `package.json` from `pkg.packageJsonPath` and applies {@link SilkPublishability.detect}.
 *
 * @since 0.4.0
 */
export const SilkPublishabilityDetectorLive: Layer.Layer<PublishabilityDetector, never, FileSystem.FileSystem> =
	Layer.effect(
		PublishabilityDetector,
		Effect.gen(function* () {
			const fs = yield* FileSystem.FileSystem;
			return {
				detect: (pkg: WorkspacePackage, _root: string) =>
					Effect.gen(function* () {
						const raw = yield* readRaw(fs, pkg.packageJsonPath);
						if (!raw) return [];
						const binding = yield* readTargetsBinding(fs, pkg.path);
						return SilkPublishability.detect(pkg.name, raw, binding);
					}),
			};
		}),
	);

/**
 * Ignore-aware override of {@link PublishabilityDetector}. `detect` short-circuits to `[]`
 * for changeset-ignored packages, then dispatches on {@link ChangesetConfig.mode}:
 * `none` → `[]`; `silk` → {@link SilkPublishability.detect}; `vanilla` → the library default.
 *
 * @remarks Requires `FileSystem` + {@link ChangesetConfig} at build.
 *
 * @since 0.4.0
 */
export const PublishabilityDetectorAdaptiveLive: Layer.Layer<
	PublishabilityDetector,
	never,
	FileSystem.FileSystem | ChangesetConfig
> = Layer.effect(
	PublishabilityDetector,
	Effect.gen(function* () {
		const fs = yield* FileSystem.FileSystem;
		const config = yield* ChangesetConfig;
		const vanilla = yield* Effect.provide(PublishabilityDetector, PublishabilityDetectorLive);

		return {
			detect: (pkg: WorkspacePackage, root: string) =>
				Effect.gen(function* () {
					if (yield* config.isIgnored(pkg.name, root)) return [];
					const mode = yield* config.mode(root);
					if (mode === "none") return [];
					if (mode === "silk") {
						const raw = yield* readRaw(fs, pkg.packageJsonPath);
						if (!raw) return [];
						const binding = yield* readTargetsBinding(fs, pkg.path);
						return SilkPublishability.detect(pkg.name, raw, binding);
					}
					return yield* vanilla.detect(pkg, root);
				}),
		};
	}),
);
