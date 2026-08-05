import { Context, Effect, FileSystem, Layer, Option, Path } from "effect";
import { REPOS_DIR } from "../constants.js";
import { ReposLockdownError } from "../errors.js";

const FILE_LOCKED_MODE = 0o444;
const DIR_LOCKED_MODE = 0o555;
const FILE_UNLOCKED_MODE = 0o644;
const DIR_UNLOCKED_MODE = 0o755;

/**
 * The {@link ReposLockdown} service shape.
 * @public
 */
export interface ReposLockdownShape {
	readonly lock: (root: string, name: string) => Effect.Effect<void, ReposLockdownError>;
	readonly unlock: (root: string, name: string) => Effect.Effect<void, ReposLockdownError>;
	readonly withUnlocked: <A, E, R>(
		root: string,
		name: string,
		effect: Effect.Effect<A, E, R>,
	) => Effect.Effect<A, E | ReposLockdownError, R>;
}

/**
 * Derives a submodule's git metadata directory (`.git/modules/...`) from the
 * checkout itself rather than assuming it is named after the manifest key.
 *
 * A submodule worktree's `<root>/.repos/<name>/.git` is normally a FILE
 * containing a single `gitdir: <path>` line pointing at the real metadata
 * directory, which git names after whatever path/name the submodule was
 * REGISTERED under — not necessarily the manifest key (e.g. this repo's own
 * `effect` entry has gitdir `.git/modules/.repos/effect-smol`). This helper
 * reads that pointer and resolves it (relative pointers are relative to the
 * directory containing the `.git` file) so callers always land on the real
 * metadata directory.
 *
 * Falls back to the name-based path `<root>/.git/modules/<REPOS_DIR>/<name>`
 * whenever the pointer can't be read (submodule not initialized, `.git`
 * missing) — this never fails, it only degrades to prior behavior. If
 * `<root>/.repos/<name>/.git` is itself a directory (a plain, non-submodule
 * checkout), it is used directly as the metadata directory.
 *
 * @internal
 */
export const resolveModuleDir = (
	fs: FileSystem.FileSystem,
	path: Path.Path,
	root: string,
	name: string,
): Effect.Effect<string> =>
	Effect.gen(function* () {
		const fallback = path.join(root, ".git", "modules", REPOS_DIR, name);
		const dotGit = path.join(root, REPOS_DIR, name, ".git");

		const info = yield* fs.stat(dotGit).pipe(Effect.option);
		if (Option.isNone(info)) {
			return fallback;
		}
		if (info.value.type === "Directory") {
			return dotGit;
		}

		const content = yield* fs.readFileString(dotGit).pipe(Effect.option);
		if (Option.isNone(content)) {
			return fallback;
		}
		const match = /^gitdir:\s*(.+)$/m.exec(content.value);
		if (!match?.[1]) {
			return fallback;
		}
		const pointer = match[1].trim();
		return path.isAbsolute(pointer) ? pointer : path.resolve(path.dirname(dotGit), pointer);
	});

/**
 * Enforces OS-level read-only permissions on vendored repos so they cannot
 * be accidentally edited outside the sync flow.
 * @public
 */
export class ReposLockdown extends Context.Service<ReposLockdown, ReposLockdownShape>()(
	"@savvy-web/silk-effects/ReposLockdown",
) {
	/**
	 * Production layer over the core FileSystem.
	 * @public
	 */
	static readonly layer: Layer.Layer<ReposLockdown, never, FileSystem.FileSystem | Path.Path> = Layer.effect(
		this,
		Effect.gen(function* () {
			const fs = yield* FileSystem.FileSystem;
			const path = yield* Path.Path;

			const chmod = (entryPath: string, mode: number) =>
				fs
					.chmod(entryPath, mode)
					.pipe(
						Effect.mapError(
							(cause) => new ReposLockdownError({ path: entryPath, reason: `chmod failed: ${String(cause)}` }),
						),
					);

			// Lock: chmod files after recursing into subdirectories, so the
			// directory is still writable while we're traversing it. Unlock:
			// chmod directories before recursing, so re-entry into a
			// newly-unlocked directory works.
			const walk = (
				dir: string,
				fileMode: number,
				dirMode: number,
				order: "lock" | "unlock",
			): Effect.Effect<void, ReposLockdownError> =>
				Effect.gen(function* () {
					if (order === "unlock") {
						yield* chmod(dir, dirMode);
					}
					const entries = yield* fs
						.readDirectory(dir)
						.pipe(
							Effect.mapError(
								(cause) => new ReposLockdownError({ path: dir, reason: `readDirectory failed: ${String(cause)}` }),
							),
						);
					for (const entry of entries) {
						const entryPath = path.join(dir, entry);
						const maybeInfo = yield* fs.stat(entryPath).pipe(Effect.option);
						if (Option.isNone(maybeInfo)) {
							continue;
						}
						const info = maybeInfo.value;
						if (info.type === "Directory") {
							yield* walk(entryPath, fileMode, dirMode, order);
						} else {
							yield* chmod(entryPath, fileMode);
						}
					}
					if (order === "lock") {
						yield* chmod(dir, dirMode);
					}
				});

			const walkRoot = (root: string, name: string, fileMode: number, dirMode: number, order: "lock" | "unlock") =>
				Effect.gen(function* () {
					const moduleDir = yield* resolveModuleDir(fs, path, root, name);
					for (const dir of [path.join(root, REPOS_DIR, name), moduleDir]) {
						const present = yield* fs
							.exists(dir)
							.pipe(
								Effect.mapError(
									(cause) => new ReposLockdownError({ path: dir, reason: `stat failed: ${String(cause)}` }),
								),
							);
						if (!present) {
							continue;
						}
						yield* walk(dir, fileMode, dirMode, order);
					}
				});

			const lock = (root: string, name: string) => walkRoot(root, name, FILE_LOCKED_MODE, DIR_LOCKED_MODE, "lock");

			const unlock = (root: string, name: string) =>
				walkRoot(root, name, FILE_UNLOCKED_MODE, DIR_UNLOCKED_MODE, "unlock");

			const withUnlocked = <A, E, R>(root: string, name: string, effect: Effect.Effect<A, E, R>) =>
				unlock(root, name).pipe(Effect.andThen(effect.pipe(Effect.ensuring(lock(root, name).pipe(Effect.ignore)))));

			return { lock, unlock, withUnlocked };
		}),
	);
}
