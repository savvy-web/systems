/**
 * Read workspace package snapshots at arbitrary git refs.
 *
 * @remarks
 * `WorkspaceDiscovery` reads the **current** workspace state. To compute
 * dependency diffs between two points in time, we also need to read
 * `pnpm-workspace.yaml` and each `package.json` as they existed at a
 * specific commit. This service shells out to `git show <ref>:<path>`
 * for each file, returns a plain-object snapshot per workspace package,
 * and caches per `(cwd, ref)` pair.
 *
 * The snapshot intentionally returns plain objects rather than
 * `WorkspacePackage` instances — `WorkspacePackage` is a `Schema.Class`
 * tightly coupled to the live filesystem, and snapshot consumers only
 * need the declared dependency records to compute a diff.
 *
 * @see {@link WorkspaceSnapshotReader} for the service tag
 * @see {@link WorkspaceSnapshotReaderLive} for the production layer
 *
 * @packageDocumentation
 */

import { execFileSync } from "node:child_process";
import { Context, Effect, Layer } from "effect";

import { GitError } from "../errors.js";

/**
 * One workspace package as it existed at a specific git ref.
 *
 * @public
 */
export interface WorkspaceSnapshot {
	/** Package name from `package.json#name`. */
	readonly name: string;
	/** Repo-relative path of the package directory at this ref. */
	readonly relativePath: string;
	/** Package version from `package.json#version`. */
	readonly version: string;
	/** Declared `dependencies` (raw strings, including `workspace:` / `catalog:` protocols). */
	readonly dependencies: Readonly<Record<string, string>>;
	/** Declared `devDependencies`. */
	readonly devDependencies: Readonly<Record<string, string>>;
	/** Declared `peerDependencies`. */
	readonly peerDependencies: Readonly<Record<string, string>>;
	/** Declared `optionalDependencies`. */
	readonly optionalDependencies: Readonly<Record<string, string>>;
}

/**
 * Effect service interface for reading workspace snapshots.
 *
 * @public
 */
export interface WorkspaceSnapshotReaderShape {
	/**
	 * Read every workspace package's snapshot at the given git ref.
	 *
	 * @param cwd - Project root (must be inside a git repo)
	 * @param ref - Any valid git revision spec — branch, tag, SHA, `HEAD~1`, etc.
	 * @returns Effect resolving to one {@link WorkspaceSnapshot} per workspace
	 *   package present at that ref, or failing with {@link GitError}
	 */
	readonly snapshotAt: (cwd: string, ref: string) => Effect.Effect<ReadonlyArray<WorkspaceSnapshot>, GitError>;
}

const _tag = Context.Tag("WorkspaceSnapshotReader");

/**
 * @internal
 */
export const WorkspaceSnapshotReaderBase = _tag<WorkspaceSnapshotReader, WorkspaceSnapshotReaderShape>();

/**
 * Effect service tag for {@link WorkspaceSnapshotReaderShape}.
 *
 * @public
 */
export class WorkspaceSnapshotReader extends WorkspaceSnapshotReaderBase {}

/* ----------------------------------------------------------------- *
 * Internal helpers
 * ----------------------------------------------------------------- */

function runGitShow(cwd: string, ref: string, path: string): Effect.Effect<string | null, GitError> {
	return Effect.try({
		try: () =>
			execFileSync("git", ["show", `${ref}:${path}`], {
				cwd,
				encoding: "utf8",
				stdio: ["ignore", "pipe", "pipe"],
			}),
		catch: (error) => {
			// git show exits non-zero when the path doesn't exist at the ref.
			// That's an expected case (e.g., new workspace package not yet
			// present at base) — surface as `null` rather than an error.
			const stderr = (error as { stderr?: Buffer | string }).stderr;
			const text = typeof stderr === "string" ? stderr : (stderr?.toString() ?? "");
			if (/exists on disk, but not in|does not exist|unknown revision|bad object/.test(text)) {
				return new GitError({
					command: `git show ${ref}:${path}`,
					cwd,
					reason: "PATH_NOT_AT_REF",
				});
			}
			return new GitError({
				command: `git show ${ref}:${path}`,
				cwd,
				reason: text.trim() || ((error as Error).message ?? String(error)),
			});
		},
	}).pipe(
		Effect.catchTag("GitError", (err) => (err.reason === "PATH_NOT_AT_REF" ? Effect.succeed(null) : Effect.fail(err))),
	);
}

/**
 * Parse a minimal `pnpm-workspace.yaml` (`packages:` list only). Tolerant
 * of comments and varied indentation; rejects on missing `packages:` key.
 */
function parseWorkspaceGlobs(yamlText: string): ReadonlyArray<string> {
	const lines = yamlText.split(/\r?\n/);
	const globs: string[] = [];
	let inPackagesBlock = false;
	for (const line of lines) {
		if (/^\s*#/.test(line)) continue;
		if (/^\s*packages\s*:\s*$/.test(line)) {
			inPackagesBlock = true;
			continue;
		}
		if (inPackagesBlock) {
			const match = line.match(/^\s+-\s+["']?(.+?)["']?\s*$/);
			if (match) {
				globs.push(match[1] as string);
				continue;
			}
			// Block ended (top-level key reached or blank+top-level)
			if (line.length > 0 && !line.startsWith(" ") && !line.startsWith("\t")) {
				inPackagesBlock = false;
			}
		}
	}
	return globs;
}

interface RawPackageJson {
	readonly name?: string;
	readonly version?: string;
	readonly dependencies?: Record<string, string>;
	readonly devDependencies?: Record<string, string>;
	readonly peerDependencies?: Record<string, string>;
	readonly optionalDependencies?: Record<string, string>;
}

function toSnapshot(pkg: RawPackageJson, relativePath: string): WorkspaceSnapshot | null {
	if (!pkg.name) return null;
	return {
		name: pkg.name,
		relativePath,
		version: pkg.version ?? "0.0.0",
		dependencies: pkg.dependencies ?? {},
		devDependencies: pkg.devDependencies ?? {},
		peerDependencies: pkg.peerDependencies ?? {},
		optionalDependencies: pkg.optionalDependencies ?? {},
	};
}

/**
 * Expand a workspace glob like `packages/*` or `apps/web` against the
 * directories present at the given git ref. We can't `globSync` here
 * (the directories may not be on disk at this ref); instead we use
 * `git ls-tree` to enumerate paths.
 */
function expandGlobAtRef(cwd: string, ref: string, glob: string): Effect.Effect<ReadonlyArray<string>, GitError> {
	return Effect.gen(function* () {
		// `packages/**` → `packages/*` so it hits the wildcard branch below;
		// `packages/*` and literal paths pass through unchanged. Stripping
		// `/**` entirely (the previous form) would silently route
		// double-star globs into the literal-path branch and miss every
		// child workspace.
		const cleanGlob = glob.replace(/\/\*\*$/, "/*");

		// For a literal path (no wildcards), just return it as-is — `git
		// ls-tree` works fine on a literal directory too, but this is an
		// optimization.
		if (!cleanGlob.includes("*") && !cleanGlob.includes("?")) {
			return [cleanGlob];
		}

		// For glob-style matches, list one level up and filter.
		const prefix = cleanGlob.includes("/") ? cleanGlob.slice(0, cleanGlob.lastIndexOf("/") + 1) : "";
		const lsTree = yield* Effect.try({
			try: () =>
				execFileSync("git", ["ls-tree", "--name-only", ref, prefix], {
					cwd,
					encoding: "utf8",
					stdio: ["ignore", "pipe", "pipe"],
				}),
			catch: (error) => {
				const stderr = (error as { stderr?: Buffer | string }).stderr;
				const text = typeof stderr === "string" ? stderr : (stderr?.toString() ?? "");
				return new GitError({
					command: `git ls-tree ${ref} ${prefix}`,
					cwd,
					reason: text.trim() || ((error as Error).message ?? String(error)),
				});
			},
		});
		const entries = lsTree
			.split(/\r?\n/)
			.map((s) => s.trim())
			.filter((s) => s.length > 0);

		// Build a regex from the glob: `*` → `[^/]*`, `?` → `[^/]`. No `**` support
		// (workspace globs don't typically use it).
		const regex = new RegExp(
			`^${cleanGlob
				.replace(/[.+^${}()|[\]\\]/g, "\\$&")
				.replace(/\*/g, "[^/]*")
				.replace(/\?/g, "[^/]")}$`,
		);
		return entries.filter((e) => regex.test(e));
	});
}

/* ----------------------------------------------------------------- *
 * Live layer
 * ----------------------------------------------------------------- */

function makeShape(): WorkspaceSnapshotReaderShape {
	const cache = new Map<string, ReadonlyArray<WorkspaceSnapshot>>();

	const snapshotAt = (cwd: string, ref: string): Effect.Effect<ReadonlyArray<WorkspaceSnapshot>, GitError> =>
		Effect.gen(function* () {
			const cacheKey = `${cwd}::${ref}`;
			const cached = cache.get(cacheKey);
			if (cached) return cached;

			// Read pnpm-workspace.yaml at the ref. If absent, treat as a
			// single-package project — read the root package.json instead.
			const wsYaml = yield* runGitShow(cwd, ref, "pnpm-workspace.yaml");
			const globs = wsYaml ? parseWorkspaceGlobs(wsYaml) : [];

			// Expand globs to concrete directories at this ref.
			const dirs: string[] = [];
			for (const glob of globs) {
				const expanded = yield* expandGlobAtRef(cwd, ref, glob);
				for (const d of expanded) {
					if (!dirs.includes(d)) dirs.push(d);
				}
			}

			// Always include the root.
			if (!dirs.includes(".")) dirs.unshift(".");

			const snapshots: WorkspaceSnapshot[] = [];
			for (const dir of dirs) {
				const pkgPath = dir === "." ? "package.json" : `${dir}/package.json`;
				const pkgText = yield* runGitShow(cwd, ref, pkgPath);
				if (!pkgText) continue;
				let parsed: RawPackageJson;
				try {
					parsed = JSON.parse(pkgText) as RawPackageJson;
				} catch {
					continue;
				}
				const snap = toSnapshot(parsed, dir);
				if (snap) snapshots.push(snap);
			}

			cache.set(cacheKey, snapshots);
			return snapshots;
		});

	return { snapshotAt };
}

/**
 * Production layer for {@link WorkspaceSnapshotReader}.
 *
 * @public
 */
export const WorkspaceSnapshotReaderLive: Layer.Layer<WorkspaceSnapshotReader> = Layer.succeed(
	WorkspaceSnapshotReader,
	makeShape(),
);
