import { Context, Effect, Exit, FileSystem, Layer, Option, Path } from "effect";
import { REPOS_DIR } from "../constants.js";
import { ReposLockdownError } from "../errors.js";

const FILE_LOCKED_BASE_MODE = 0o444;
const DIR_LOCKED_MODE = 0o555;
const FILE_UNLOCKED_BASE_MODE = 0o644;
const DIR_UNLOCKED_MODE = 0o755;
const EXEC_BITS = 0o111;

/**
 * Preserves the executable bit through a lock/unlock transition: a file
 * whose current mode has any of the owner/group/other execute bits set
 * locks to `0o555` and unlocks to `0o755` instead of stripping execute
 * permission entirely.
 */
const fileModeFor = (baseMode: number, currentMode: number): number =>
	baseMode | (currentMode & EXEC_BITS ? EXEC_BITS : 0);

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
 * REGISTERED under — not necessarily the manifest key. Git never renames
 * that directory, so a manifest entry re-slugged after it was first vendored
 * keeps its original gitdir name indefinitely (manifest key `<new>`, gitdir
 * `.git/modules/.repos/<old>`). `ReposDrift` reports that state as
 * `localRegistrationDivergence`; re-vendoring the entry clears it. This helper
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
		const resolved = path.isAbsolute(pointer) ? pointer : path.resolve(path.dirname(dotGit), pointer);

		// A hand-edited (or otherwise malicious) `gitdir:` pointer could escape
		// the repository root entirely (e.g. `gitdir: ../../../../etc`), which
		// would make the caller chmod a tree outside the repo. Fall back to the
		// name-based path whenever the resolved pointer isn't contained under
		// `root`.
		const relative = path.relative(root, resolved);
		if (relative.startsWith("..") || path.isAbsolute(relative)) {
			return fallback;
		}
		return resolved;
	});

/**
 * Enforces OS-level read-only permissions on vendored repos so they cannot
 * be accidentally edited outside the sync flow.
 *
 * @remarks
 * SCOPE: the WORKTREE only. The submodule's git metadata directory
 * (`.git/modules/...`) is deliberately NOT locked — `unlock` still walks it
 * so trees locked by an older version are freed, but `lock` never re-locks
 * it. Do not "restore" the metadata lock without re-reading this note.
 *
 * Locking the metadata directory made the boundary enforce itself only via
 * `EACCES`, whose message names neither `.repos/` nor a reason, and it broke
 * every client that needs incidental gitdir writes: a plain `git pull` that
 * moves a gitlink recurses by default and dies writing `FETCH_HEAD`, and any
 * client keeping per-gitdir state (GitKraken writes a `gk/` directory into
 * every gitdir it manages, which no git setting governs) is structurally
 * incompatible with a read-only gitdir. Since vendored reference sources are
 * the overwhelming majority of submodules in this ecosystem, ordinary tooling
 * collided with the lockdown constantly.
 *
 * What the worktree lock still buys, verified against git 2.54:
 *
 * - editing a vendored file fails (`EACCES`) — the property the system
 *   actually needs;
 * - `git reset --hard` inside a vendored tree fails (cannot unlink);
 * - `git checkout <other>` does NOT fail — it moves `HEAD` while leaving the
 *   worktree stale. That is the one guarantee given up here, and it is given
 *   up knowingly: git immediately reports the submodule as `+<oid>`, which
 *   {@link ReposDrift} already classifies as `checkoutDiverged` and
 *   `ReposManager.restore` repairs.
 *
 * So the invariant weakens from "the pin cannot drift" to "a drifted pin is
 * always detected and one command from repaired." The declarative half of the
 * boundary — `submodule.<path>.update = none`, so clients skip these trees
 * rather than discovering the boundary by failing — is asserted by
 * `ReposManager.sync`, not here.
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

			// `fs.stat` follows symlinks, so a symlink inside a vendored tree
			// would otherwise cause the walk to chmod (and, for a symlinked
			// directory, descend into and chmod the CONTENTS of) something
			// outside the locked root, and a symlink cycle could hang the walk
			// forever. There is no `lchmod` on Linux, so a symlink can never be
			// locked itself — the only safe move is to skip it entirely: no
			// chmod, no descent. `readLink` succeeding is the detection: it
			// only succeeds on an actual symbolic link.
			const isSymlink = (entryPath: string) => fs.readLink(entryPath).pipe(Effect.option, Effect.map(Option.isSome));

			// Lock: chmod files after recursing into subdirectories, so the
			// directory is still writable while we're traversing it. Unlock:
			// chmod directories before recursing, so re-entry into a
			// newly-unlocked directory works.
			const walk = (
				dir: string,
				fileBaseMode: number,
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
						if (yield* isSymlink(entryPath)) {
							continue;
						}
						const maybeInfo = yield* fs.stat(entryPath).pipe(Effect.option);
						if (Option.isNone(maybeInfo)) {
							continue;
						}
						const info = maybeInfo.value;
						if (info.type === "Directory") {
							yield* walk(entryPath, fileBaseMode, dirMode, order);
						} else {
							yield* chmod(entryPath, fileModeFor(fileBaseMode, info.mode));
						}
					}
					if (order === "lock") {
						yield* chmod(dir, dirMode);
					}
				});

			// ASYMMETRIC BY DESIGN — read the module-gitdir note on the class
			// before "fixing" the asymmetry. Lock walks the WORKTREE only;
			// unlock walks the worktree AND the module gitdir. That asymmetry
			// IS the one-way migration off the old both-trees lock: every
			// `withUnlocked` bracket frees a gitdir a previous version locked
			// and never re-locks it, so one `savvy repos sync` migrates a whole
			// repo. Unlocking an already-unlocked gitdir is a no-op chmod, so
			// this stays correct once every tree has migrated.
			const walkRoot = (root: string, name: string, fileBaseMode: number, dirMode: number, order: "lock" | "unlock") =>
				Effect.gen(function* () {
					const worktree = path.join(root, REPOS_DIR, name);
					const targets = order === "unlock" ? [worktree, yield* resolveModuleDir(fs, path, root, name)] : [worktree];
					for (const dir of targets) {
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
						yield* walk(dir, fileBaseMode, dirMode, order);
					}
				});

			const lock = (root: string, name: string) => walkRoot(root, name, FILE_LOCKED_BASE_MODE, DIR_LOCKED_MODE, "lock");

			const unlock = (root: string, name: string) =>
				walkRoot(root, name, FILE_UNLOCKED_BASE_MODE, DIR_UNLOCKED_MODE, "unlock");

			// Contract: relock is always attempted once the unlock has begun —
			// including when the unlock walk itself failed part-way (leaving the
			// tree partially writable) and on interruption of the inner effect.
			// A relock failure propagates as `ReposLockdownError` only when it
			// is the SOLE failure; an inner-effect (or unlock) failure always
			// wins and the relock failure is swallowed in that case. The whole
			// sequence runs uninterruptibly apart from the inner effect itself,
			// so relock always gets to run as a proper finalizer even if the
			// inner effect is interrupted.
			const withUnlocked = <A, E, R>(root: string, name: string, effect: Effect.Effect<A, E, R>) =>
				Effect.uninterruptibleMask((restore) =>
					Effect.gen(function* () {
						const unlockExit = yield* Effect.exit(unlock(root, name));
						const resultExit: Exit.Exit<A, E | ReposLockdownError> = Exit.isFailure(unlockExit)
							? Exit.failCause(unlockExit.cause)
							: yield* Effect.exit(restore(effect));
						const relockExit = yield* Effect.exit(lock(root, name));
						if (Exit.isFailure(resultExit)) {
							return yield* Exit.failCause(resultExit.cause);
						}
						if (Exit.isFailure(relockExit)) {
							return yield* Exit.failCause(relockExit.cause);
						}
						return resultExit.value;
					}),
				);

			return { lock, unlock, withUnlocked };
		}),
	);
}
