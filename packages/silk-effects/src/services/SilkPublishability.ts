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

/** A single declared publish target in a raw `publishConfig.targets` array. */
export type RawTargetSpec =
	| string
	| {
			readonly access?: "public" | "restricted";
			readonly protocol?: string;
			readonly registry?: string;
			readonly directory?: string;
			readonly provenance?: boolean;
	  };

/** Raw `publishConfig` shape (the unschematized fields silk rules consult). */
export interface RawPublishConfig {
	readonly access?: "public" | "restricted";
	readonly registry?: string;
	readonly directory?: string;
	readonly targets?: ReadonlyArray<RawTargetSpec>;
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
	 * Resolve the access for one target spec. String targets always inherit the parent
	 * `publishConfig.access`; object targets use their own `.access` else the parent's.
	 */
	static resolveTargetAccess(
		target: RawTargetSpec,
		parentAccess: "public" | "restricted" | undefined,
	): "public" | "restricted" | undefined {
		if (typeof target === "string") return parentAccess;
		return target.access ?? parentAccess;
	}

	/**
	 * Expand a shorthand string target to a registry URL. `"npm"`/`"github"`/`"jsr"` map to
	 * canonical registries; `http(s)://…` is verbatim; anything else falls back to the parent
	 * `publishConfig.registry` (or the npm default).
	 */
	static expandShorthand(target: string, parentRegistry: string | undefined): string {
		if (target === "npm") return NPM_DEFAULT;
		if (target === "github") return "https://npm.pkg.github.com/";
		if (target === "jsr") return "https://jsr.io/";
		if (target.startsWith("https://") || target.startsWith("http://")) return target;
		return parentRegistry ?? NPM_DEFAULT;
	}

	/**
	 * Apply silk publishability rules to a raw `package.json`. Targets-first precedence:
	 * `publishConfig.targets` → one PublishTarget per surviving target (regardless of
	 * `private`); else `publishConfig.access` → one target; else `private !== true` → one
	 * default target; else `[]`.
	 */
	static detect(pkgName: string, raw: RawPackageJson): ReadonlyArray<PublishTarget> {
		const pc = raw.publishConfig;

		if (pc?.targets && pc.targets.length > 0) {
			const results: PublishTarget[] = [];
			for (const target of pc.targets) {
				const access = SilkPublishability.resolveTargetAccess(target, pc.access);
				if (access !== "public" && access !== "restricted") continue;
				const registry =
					typeof target === "string"
						? SilkPublishability.expandShorthand(target, pc.registry)
						: (target.registry ?? pc.registry ?? NPM_DEFAULT);
				const directory =
					typeof target === "string" ? (pc.directory ?? ".") : (target.directory ?? pc.directory ?? ".");
				const provenance = typeof target === "string" ? undefined : target.provenance;
				results.push(
					new PublishTarget({
						name: pkgName,
						registry,
						directory,
						access,
						...(provenance !== undefined ? { provenance } : {}),
					}),
				);
			}
			return results;
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
					readRaw(fs, pkg.packageJsonPath).pipe(
						Effect.map((raw) => (raw ? SilkPublishability.detect(pkg.name, raw) : [])),
					),
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
						return raw ? SilkPublishability.detect(pkg.name, raw) : [];
					}
					return yield* vanilla.detect(pkg, root);
				}),
		};
	}),
);
