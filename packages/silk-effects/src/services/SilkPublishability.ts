import { isAbsolute, join, relative } from "node:path";
import type { WorkspacePackage } from "@effected/workspaces";
import { PublishTarget, PublishabilityDetector, WorkspaceDiscovery } from "@effected/workspaces";
import { Effect, FileSystem, Layer } from "effect";
import { PublishTargetBindingError } from "../errors/PublishTargetBindingError.js";
import { trimTrailingSlashes } from "../utils/TrailingSlash.js";
import { ChangesetConfig } from "./ChangesetConfig.js";

/**
 * A single object-form publish target in the `publishConfig.targets` map (mirrors the bundler's `PublishTargetObject`).
 * @public
 */
export interface RawTargetObject {
	/** Registry endpoint. Defaulted for the well-known `npm`/`github` keys. */
	readonly registry?: string;
	/** Name override for this target's own group. Mutually exclusive with `from`. */
	readonly name?: string;
	/** Reuse another target's group bytes. Mutually exclusive with `name`. */
	readonly from?: string;
}

/**
 * A `publishConfig.targets` value: `true` (well-known registry, base name), a string (name override), or an object.
 * @public
 */
export type RawTargetValue = true | string | RawTargetObject;

/**
 * The `publishConfig.targets` map, keyed by target id (`npm`, `github`, or a custom key).
 *
 * @remarks
 * This is the bundler's Record-map form. The legacy array form is no longer supported
 * (removed in the 1.0 breaking change) — declare targets as a keyed map and let the
 * bundler emit the {@link TargetsBinding} that silk publishability resolves against.
 * @public
 */
export type RawPublishTargets = Record<string, RawTargetValue>;

/**
 * Raw `publishConfig` shape (the unschematized fields silk rules consult).
 * @public
 */
export interface RawPublishConfig {
	readonly access?: "public" | "restricted";
	readonly registry?: string;
	readonly directory?: string;
	readonly targets?: RawPublishTargets;
}

/**
 * A resolved byte-variant group from the bundler's `dist/prod/targets.json` binding.
 * @public
 */
export interface TargetGroupBinding {
	/** Group folder id; the group's bytes live at `dir`. */
	readonly id: string;
	/** The `package.json.name` this group's manifest carries. */
	readonly name: string;
	/** The group's pkg output dir, relative to the package root (e.g. `dist/prod/npm/pkg`). */
	readonly dir: string;
}

/**
 * A resolved registry target from the bundler's `dist/prod/targets.json` binding (one per `publishConfig.targets` key).
 * @public
 */
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
 * @public
 */
export interface TargetsBinding {
	readonly groups: ReadonlyArray<TargetGroupBinding>;
	readonly targets: ReadonlyArray<TargetBinding>;
}

/**
 * Raw `package.json` shape consumed by `SilkPublishability.detect`.
 * @public
 */
export interface RawPackageJson {
	readonly name?: string;
	readonly version?: string;
	readonly private?: boolean;
	readonly publishConfig?: RawPublishConfig;
}

/**
 * A publishable workspace package and the count of its resolved publish targets.
 * @public
 */
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
 * Whether a registry endpoint participates in npm-style SLSA provenance.
 *
 * @remarks
 * The npm public registry and GitHub Packages both accept provenance attestations through the
 * Sigstore/OIDC trusted-publishing flow, so a `PublishTarget` bound to either is marked
 * `provenance: true` by default — this is what gates the release action's attestation step. JSR
 * and custom registries do not participate and resolve to `false`. Matching is endpoint-based
 * (not target-key based) so a custom key pointed at one of these registries still opts in.
 */
const provenanceForRegistry = (registry: string): boolean => {
	// Exact hostname match, never substring: `.includes("registry.npmjs.org")` would also accept a
	// crafted URL like `https://evil.example/registry.npmjs.org` and wrongly opt it into attestation
	// (CWE-20). A bare hostname (no scheme) is normalized so a `registry.npmjs.org` value still resolves.
	const normalized = /^[a-z]+:\/\//i.test(registry) ? registry : `https://${registry}`;
	let hostname: string;
	try {
		hostname = new URL(normalized).hostname.toLowerCase();
	} catch {
		return false;
	}
	return hostname === "registry.npmjs.org" || hostname === "npm.pkg.github.com";
};

/**
 * Silk publishability rules over `@effected/workspaces`' `PublishTarget`.
 *
 * @remarks
 * In silk mode `private: true` is the norm on workspace `package.json`; publishability is
 * derived from `publishConfig`, with the `private` flag consulted only as a last-resort
 * default. All helpers are static so a consumer sees the full rule surface in one place.
 *
 * @since 0.4.0
 * @public
 */
export class SilkPublishability {
	/**
	 * Apply silk publishability rules to a raw `package.json` and the bundler's resolved
	 * target binding. Targets-first precedence:
	 *
	 * - A non-empty `publishConfig.targets` map (the bundler's Record-map form) makes the
	 *   package publishable regardless of `private`. With a `binding` (post-prod-build), one
	 *   `PublishTarget` is emitted per resolved registry target, its `directory` set to
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
							provenance: provenanceForRegistry(t.registry),
						}),
				);
			}
			// Pre-build: no binding yet. Emit one placeholder per declared key so publishability
			// and target counts are correct; the directory is best-effort (group collapsing is
			// only known from the binding) and unused until the prod build writes it.
			return Object.entries(targets).map(([id, target]) => {
				// An object-form target carries its own registry; honor it pre-build so a custom-registry
				// target reports the right registry (and provenance) before targets.json exists, instead
				// of falling back to the npm default.
				const registry =
					typeof target === "object" && target !== null && typeof target.registry === "string"
						? target.registry
						: (DEFAULT_REGISTRIES[id] ?? pc?.registry ?? NPM_DEFAULT);
				return new PublishTarget({
					name: pkgName,
					registry,
					directory: `dist/prod/${id}/pkg`,
					access,
					provenance: provenanceForRegistry(registry),
				});
			});
		}

		if (pc && (pc.access === "public" || pc.access === "restricted")) {
			const registry = pc.registry ?? NPM_DEFAULT;
			return [
				new PublishTarget({
					name: pkgName,
					registry,
					directory: pc.directory ?? ".",
					access: pc.access,
					provenance: provenanceForRegistry(registry),
				}),
			];
		}

		if (raw.private !== true) {
			const registry = pc?.registry ?? NPM_DEFAULT;
			return [
				new PublishTarget({
					name: pkgName,
					registry,
					directory: pc?.directory ?? ".",
					access: pc?.access ?? "public",
					provenance: provenanceForRegistry(registry),
				}),
			];
		}

		return [];
	}

	/**
	 * Resolve a package's publish targets via {@link SilkPublishability}, then drop any
	 * whose built `directory` package.json is `private: true`. Returned targets keep the
	 * detector's original (possibly package-relative) `directory`.
	 *
	 * @remarks
	 * When the prod build has written `dist/prod/targets.json`, that binding is
	 * authoritative: every surviving target's directory must be one of the group
	 * directories it names. A directory outside the binding means detection did
	 * not select the prod output — the `yaml-effect@0.7.1` shape, where a dev
	 * manifest carrying `catalog:` specifiers was packed and published. Rather
	 * than ship those bytes, fail with {@link PublishTargetBindingError}.
	 *
	 * Before the prod build runs there is no binding, and the detector's
	 * placeholder directories are left alone.
	 */
	static resolveTargets(
		pkg: WorkspacePackage,
		_root: string,
	): Effect.Effect<
		ReadonlyArray<PublishTarget>,
		PublishTargetBindingError,
		PublishabilityDetector | FileSystem.FileSystem
	> {
		return Effect.gen(function* () {
			const detector = yield* PublishabilityDetector;
			const fs = yield* FileSystem.FileSystem;
			const targets = yield* detector.detect(pkg);
			const kept: PublishTarget[] = [];
			for (const t of targets) {
				const dir = isAbsolute(t.directory) ? t.directory : join(pkg.path, t.directory);
				if (!(yield* isTargetPrivate(fs, dir))) kept.push(t);
			}

			const binding = yield* readTargetsBinding(fs, pkg.path);
			if (binding === null) return kept;

			// Compare on package-relative POSIX paths: the detector may hand back either
			// form, while the binding always records package-relative dirs.
			const boundDirectories = binding.groups.map((g) => normalizeDir(g.dir));
			const bound = new Set(boundDirectories);
			for (const t of kept) {
				const relativeDir = normalizeDir(isAbsolute(t.directory) ? relative(pkg.path, t.directory) : t.directory);
				if (!bound.has(relativeDir)) {
					return yield* Effect.fail(
						new PublishTargetBindingError({ pkg: pkg.name, directory: relativeDir, boundDirectories }),
					);
				}
			}
			return kept;
		});
	}

	/**
	 * The publishable, non-ignored packages, resolved through the single
	 * {@link SilkPublishability} (which already honors changeset ignore in adaptive mode).
	 */
	static listPublishable(
		_root: string,
	): Effect.Effect<ReadonlyArray<PublishablePackage>, never, WorkspaceDiscovery | PublishabilityDetector> {
		return Effect.gen(function* () {
			const discovery = yield* WorkspaceDiscovery;
			const detector = yield* PublishabilityDetector;
			// Discovery errors become defects (the `never` error channel): this resolver assumes a
			// healthy workspace. Callers needing to recover from discovery failure should yield
			// `WorkspaceDiscovery` directly rather than wrapping this in `Effect.catch`.
			const packages = yield* discovery.listPackages().pipe(Effect.orDie);
			const out: PublishablePackage[] = [];
			for (const pkg of packages) {
				const targets = yield* detector.detect(pkg);
				if (targets.length > 0) {
					out.push({ name: pkg.name, version: pkg.version, path: pkg.path, targetCount: targets.length });
				}
			}
			return out;
		});
	}
}

/**
 * Reduce a directory to a comparable package-relative POSIX path: backslashes to
 * forward slashes, no `./` prefix, no trailing slash. `""` (the package root)
 * normalizes to `.`, matching how a root-directory target is recorded.
 *
 * @remarks
 * Trailing-slash trimming is delegated to the shared `trimTrailingSlashes`
 * index-scan helper rather than `/\/+$/`: that regex is unanchored at the
 * start, so the engine retries the match from every position and degrades to
 * O(n²) on a path of many slashes (CodeQL `js/polynomial-redos`). `dir` reaches
 * here from `dist/prod/targets.json`, which the bundler writes but a consumer
 * repo could hand-edit.
 */
const normalizeDir = (dir: string): string => {
	const slashed = dir.replaceAll("\\", "/");
	const withoutPrefix = slashed.startsWith("./") ? slashed.slice(2) : slashed;
	const normalized = trimTrailingSlashes(withoutPrefix);
	return normalized === "" ? "." : normalized;
};

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
 * has run. `SilkPublishability.detect` falls back to declared-key placeholders in that
 * case. Used by the silk {@link SilkPublishability} layers and the workspace analyzer.
 *
 * @param fs - The FileSystem service.
 * @param pkgPath - Absolute path to the package directory.
 * @since 1.0.0
 * @public
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
 * Override of `@effected/workspaces`' `PublishabilityDetector` Tag with pure silk rules.
 *
 * @remarks Requires `FileSystem` (captured at layer build); `detect` reads the raw
 * `package.json` from `pkg.packageJsonPath` and applies `SilkPublishability.detect`.
 *
 * @since 0.4.0
 * @public
 */
export const SilkPublishabilityDetectorLive: Layer.Layer<PublishabilityDetector, never, FileSystem.FileSystem> =
	Layer.effect(
		PublishabilityDetector,
		Effect.gen(function* () {
			const fs = yield* FileSystem.FileSystem;
			return {
				detect: (pkg: WorkspacePackage) =>
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
 * The workspace root a package was discovered against, derived from its own
 * coordinates: `relativePath` is the package directory relative to the
 * discovery root (POSIX, `"."` for the root package), so ascending one level
 * per path segment from `pkg.path` lands exactly on that root.
 *
 * @remarks
 * Derivation is deliberate — probing the filesystem for workspace markers
 * (`WorkspaceRoot.find`) can walk PAST the intended root when that root
 * carries no marker (a fixture tree, a bare directory) and land on an
 * enclosing workspace, silently swapping in that outer root's
 * `.changeset/config.json` and dropping the ignore/mode gating (the #209
 * regression class). The discovery root needs no probing: whoever built the
 * `WorkspacePackage` already knew it.
 */
const packageRoot = (pkg: WorkspacePackage): string => {
	const segments = pkg.relativePath.split("/").filter((segment) => segment !== "" && segment !== ".");
	return segments.length === 0 ? pkg.path : join(pkg.path, ...segments.map(() => ".."));
};

/**
 * Ignore-aware override of `PublishabilityDetector`. `detect` short-circuits to `[]`
 * for changeset-ignored packages, then dispatches on `ChangesetConfig.mode`:
 * `none` → `[]`; `silk` → `SilkPublishability.detect`; `vanilla` → the library default.
 *
 * @remarks Requires `FileSystem` and {@link ChangesetConfig} at build.
 * The kit's `detect` contract no longer receives the workspace root, so the changeset
 * lookups derive it per package from the package's own discovery coordinates
 * (`pkg.path` ascended by `pkg.relativePath` — never a filesystem marker walk,
 * which could escape an unmarked root and read the wrong `.changeset/config.json`).
 *
 * @since 0.4.0
 * @public
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
		const vanilla = yield* Effect.provide(PublishabilityDetector, PublishabilityDetector.layer);

		return {
			detect: (pkg: WorkspacePackage) =>
				Effect.gen(function* () {
					const root = packageRoot(pkg);
					if (yield* config.isIgnored(pkg.name, root)) return [];
					const mode = yield* config.mode(root);
					if (mode === "none") return [];
					if (mode === "silk") {
						const raw = yield* readRaw(fs, pkg.packageJsonPath);
						if (!raw) return [];
						const binding = yield* readTargetsBinding(fs, pkg.path);
						return SilkPublishability.detect(pkg.name, raw, binding);
					}
					return yield* vanilla.detect(pkg);
				}),
		};
	}),
);
