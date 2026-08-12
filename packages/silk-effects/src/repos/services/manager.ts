import { createHash } from "node:crypto";
import type { GitmodulesEntry } from "@effected/git";
import { Git, GitConfig, Gitmodules, LsRemoteEntry } from "@effected/git";
import { Clock, Context, Effect, Exit, FileSystem, Layer, Option, Path, Result, Schema } from "effect";
import { MANIFEST_PATH, NOTE_LIMIT, REPOS_DIR } from "../constants.js";
import type { ReposLockdownError } from "../errors.js";
import { GitSubmoduleError, NoteNotFoundError, RepoNotFoundError, ReposConfigError } from "../errors.js";
import type { RepoEntry, RepoNote, RepoOrientation, ReposManifestFile } from "../schemas/manifest.js";
import { RepoName } from "../schemas/manifest.js";
import type {
	ReposAddResult,
	ReposNoteResult,
	ReposPinResult,
	ReposRemoveResult,
	ReposRenameResult,
	ReposRestoreResult,
	ReposStatusReport,
	ReposSyncReport,
} from "../schemas/reports.js";
import { ReposConfigStore } from "./config-store.js";
import { ReposLockdown, resolveModuleDir } from "./lockdown.js";

/**
 * Lock files git leaves behind when a submodule fetch is interrupted; `sync`
 * clears these before attempting to (re)initialize a submodule.
 */
const STALE_LOCKS = ["index.lock", "shallow.lock"] as const;

/**
 * Minimum age (in milliseconds) a `.lock` file must reach before `sync` will
 * remove it. An ACTIVE git process can legitimately hold
 * `index.lock`/`shallow.lock` for the duration of its own run; removing a
 * young lock out from under it would corrupt the submodule. Ten minutes
 * comfortably exceeds any single shallow fetch/checkout this manager
 * performs, while still reclaiming locks abandoned by a process that was
 * killed or crashed. A lock younger than this is left in place — the
 * subsequent git operation fails naturally if it is genuinely contested,
 * and that failure already propagates.
 * @public
 */
export const STALE_LOCK_MAX_AGE_MS = 10 * 60_000;

/**
 * The full contractual surface of {@link ReposManager}. All five methods are
 * implemented against real git plumbing and the manifest store: `status`
 * reports drift, `sync` reconciles the working tree with the manifest,
 * `add` vendors a new repo, `pin` re-pins an existing entry to a new ref,
 * and `note` adds, removes, or promotes an agent note.
 * @internal
 */
export interface ReposManagerShape {
	readonly status: (root: string) => Effect.Effect<ReposStatusReport, ReposConfigError | GitSubmoduleError>;
	readonly sync: (
		root: string,
	) => Effect.Effect<ReposSyncReport, ReposConfigError | GitSubmoduleError | ReposLockdownError>;
	/**
	 * Vendors a new repo.
	 *
	 * `options.orientation` exists so a re-vendor can be LOSSLESS in one call.
	 * Remove-then-re-add is the remedy for several vendored-tree problems, and
	 * without this parameter that remedy silently destroys the entry's
	 * orientation block — the durable, hand-curated part an agent reads to know
	 * where to look in the tree, and the part no report mentions is gone.
	 * Notes are ephemeral by policy and are NOT carried across a re-vendor;
	 * orientation is, when the caller passes it back (see
	 * {@link ReposRemoveResult.removedEntry}, which hands it to them).
	 */
	readonly add: (
		root: string,
		options: {
			readonly url: string;
			readonly ref: string;
			readonly purpose: string;
			readonly name?: string;
			readonly sparse?: ReadonlyArray<string>;
			readonly orientation?: RepoOrientation;
		},
	) => Effect.Effect<ReposAddResult, ReposConfigError | GitSubmoduleError | ReposLockdownError>;
	readonly pin: (
		root: string,
		name: string,
		ref: string,
	) => Effect.Effect<ReposPinResult, ReposConfigError | GitSubmoduleError | RepoNotFoundError | ReposLockdownError>;
	readonly note: (
		root: string,
		name: string,
		op:
			| { readonly op: "add"; readonly note: string }
			| { readonly op: "remove"; readonly id: string }
			| { readonly op: "promote"; readonly id: string; readonly into: "layout" | "startHere" },
	) => Effect.Effect<ReposNoteResult, ReposConfigError | RepoNotFoundError | NoteNotFoundError>;
	readonly remove: (
		root: string,
		name: string,
	) => Effect.Effect<ReposRemoveResult, ReposConfigError | GitSubmoduleError | RepoNotFoundError | ReposLockdownError>;
	/**
	 * Crash contract: unlike {@link add}, `rename` has no compensating
	 * rollback. `Effect.uninterruptibleMask` guards fiber interruption, not a
	 * hard process kill, so a `kill -9` between `git mv` and the manifest
	 * write can leave the tree renamed in git, the manifest still holding
	 * the old key, and the tree unlocked (the relock finalizer never runs).
	 * This is a deliberate asymmetry with `add`, which DOES roll back —
	 * `rename` does not, because unlike a fresh vendor there is no "nothing
	 * happened yet" state to unwind back to.
	 *
	 * Recovery is NOT a guaranteed clean "just run it again": `git mv` is not
	 * idempotent (a real-git probe confirms a second `git mv <old> <new>`
	 * after the first already succeeded fails with "bad source"), so a crash
	 * after `git mv` lands makes the next `rename` call fail at that same
	 * step rather than resume past it. A crash in that window needs manual
	 * inspection (`git status`, `.repos/config.json`, `.gitmodules`) before
	 * retrying, not a blind re-invocation.
	 */
	readonly rename: (
		root: string,
		oldName: string,
		newName: string,
	) => Effect.Effect<ReposRenameResult, ReposConfigError | GitSubmoduleError | RepoNotFoundError | ReposLockdownError>;
	readonly restore: (
		root: string,
		names?: ReadonlyArray<string>,
	) => Effect.Effect<ReposRestoreResult, ReposConfigError | GitSubmoduleError | RepoNotFoundError | ReposLockdownError>;
}

/**
 * Drives the vendored `.repos/` submodules over git: reports status
 * (presence, dirtiness, stale notes), reconciles the working tree with the
 * manifest, vendors new entries (`add`), re-pins existing entries to a new
 * ref (`pin`), adds/removes/promotes agent notes (`note`), unvendors
 * (`remove`), renames (`rename`), and explicitly hard-resets dirty
 * checkouts back to their pinned commit (`restore`).
 * @public
 */
export class ReposManager extends Context.Service<ReposManager, ReposManagerShape>()(
	"@savvy-web/silk-effects/ReposManager",
) {
	/**
	 * Production implementation of {@link ReposManager}.
	 *
	 * @remarks
	 * All git plumbing runs through `@effected/git`'s `Git` service (captured once
	 * at layer construction; `Git.layer` requires `ChildProcessSpawner` at the app
	 * edge), so the public method effects stay at `R = never`. The kit classifies
	 * git's exit-code/stderr taxonomy into typed failures, which are mapped onto
	 * this module's {@link GitSubmoduleError} to keep the declared error unions.
	 * @public
	 */
	static readonly layer: Layer.Layer<
		ReposManager,
		never,
		ReposConfigStore | Git | FileSystem.FileSystem | Path.Path | ReposLockdown
	> = Layer.effect(
		this,
		Effect.gen(function* () {
			const configStore = yield* ReposConfigStore;
			const fs = yield* FileSystem.FileSystem;
			const path = yield* Path.Path;
			const git = yield* Git;
			const lockdown = yield* ReposLockdown;

			/** Map any typed `@effected/git` failure onto this module's `GitSubmoduleError`. */
			const asSubmoduleError =
				(command: string, cwd: string) =>
				(error: { readonly message: string }): GitSubmoduleError =>
					new GitSubmoduleError({ command, cwd, reason: error.message });

			const isPresent = (repoPath: string) =>
				fs.readDirectory(repoPath).pipe(
					Effect.map((files) => files.length > 0),
					Effect.orElseSucceed(() => false),
				);

			/**
			 * `Object.hasOwn`-guarded membership read for the manifest's `repos`
			 * map. A bare bracket read (`repos[name]`) resolves an INHERITED
			 * `Object.prototype` member for a name like `"constructor"` or
			 * `"toString"` instead of reporting absence, letting a crafted repo
			 * name read back a function rather than fail typed as
			 * `RepoNotFoundError` (the same prototype-pollution-read hazard
			 * `ReleasePlanner` guards against for changelog module ids).
			 */
			const getRepoEntry = (repos: ReposManifestFile["repos"], name: string): RepoEntry | undefined =>
				Object.hasOwn(repos, name) ? repos[name] : undefined;

			const status = (root: string) =>
				Effect.gen(function* () {
					const manifest = yield* configStore.read(root);
					const repos = yield* Effect.forEach(Object.entries(manifest.repos), ([name, entry]) =>
						Effect.gen(function* () {
							const repoPath = path.join(root, REPOS_DIR, name);
							const repoPathRel = `${REPOS_DIR}/${name}`;
							const present = yield* isPresent(repoPath);

							// An empty listing is a legitimate non-error: the path simply isn't
							// tracked at HEAD yet (e.g. `add` staged but not committed). A
							// failing `ls-tree` invocation itself (not present in this repo
							// at all, corrupt HEAD, etc.) is a real git failure and must
							// propagate as `GitSubmoduleError` rather than be read as "no
							// commit".
							const lsTree = yield* git
								.lsTree(root, "HEAD", { pathspec: [repoPathRel] })
								.pipe(Effect.mapError(asSubmoduleError(`git ls-tree HEAD -- ${repoPathRel}`, root)));
							const committedCommit = lsTree[0]?.oid;

							// `ls-files --stage` reads the INDEX -- the only place a
							// staged-but-uncommitted pin is visible; `ls-tree` above reads
							// committed `HEAD` and misses exactly that window.
							const lsFiles = yield* git
								.lsFiles(root, { pathspec: [repoPathRel] })
								.pipe(Effect.mapError(asSubmoduleError(`git ls-files --stage -- ${repoPathRel}`, root)));
							const stagedCommit = lsFiles.find((lsFilesEntry) => lsFilesEntry.mode === "160000")?.oid;

							// The commit actually checked out inside the submodule's own
							// worktree. Only `NotARepositoryError` folds to absence here --
							// git's OWN "not a git repository" classification (a genuinely
							// broken/absent `.git` gitdir pointer included) is the sole
							// signal that means "no checkout here at all." Any OTHER
							// `revParse` failure -- e.g. a `HEAD` symref pointing at a branch
							// that doesn't exist -- is a git repository that IS there but is
							// corrupted, which is exactly the class of problem `status`
							// exists to surface, so it propagates as `GitSubmoduleError` like
							// every other git read in this method.
							const checkedOutCommit = present
								? yield* git.revParse(repoPath, "HEAD").pipe(
										Effect.catchTag("NotARepositoryError", () => Effect.succeed(undefined)),
										Effect.mapError(asSubmoduleError("git rev-parse HEAD", repoPath)),
									)
								: undefined;

							let dirty = false;
							if (present) {
								const porcelain = yield* git
									.status(repoPath)
									.pipe(Effect.mapError(asSubmoduleError("git status --porcelain", repoPath)));
								dirty = porcelain.length > 0;
							}

							const staleNoteIds = (entry.notes ?? []).filter((note) => note.ref !== entry.ref).map((note) => note.id);

							return {
								name,
								ref: entry.ref,
								purpose: entry.purpose,
								present,
								...(stagedCommit !== undefined ? { stagedCommit } : {}),
								...(committedCommit !== undefined ? { committedCommit } : {}),
								...(checkedOutCommit !== undefined ? { checkedOutCommit } : {}),
								dirty,
								staleNoteIds,
							};
						}),
					);

					const clean = repos.every((entry) => entry.present && !entry.dirty && entry.staleNoteIds.length === 0);
					return { repos, clean };
				});

			const sync = (root: string) =>
				Effect.gen(function* () {
					const manifest = yield* configStore.read(root);
					const initialized: string[] = [];
					const sparseApplied: string[] = [];
					const upToDate: string[] = [];
					const clearedLocks: string[] = [];
					const urlSynced: string[] = [];
					const registered: string[] = [];
					const boundaryMarked: string[] = [];

					const gitmodulesPath = path.join(root, ".gitmodules");

					// Declare the vendored boundary to git, in the superproject's
					// LOCAL config (never `.gitmodules` — this is a property of this
					// checkout's workflow, not of the vendored repo, and must not be
					// published to anyone cloning us).
					//
					// `fetch.recurseSubmodules = false`: git's default is `on-demand`,
					// which recurses whenever a pull moves a gitlink. That is the exact
					// shape that used to die writing `FETCH_HEAD` into a locked gitdir;
					// with the gitdir lock gone it no longer errors, but recursing into
					// pinned reference sources is still pure waste — nothing here ever
					// wants a fetch it did not ask for.
					yield* git
						.configSet(root, "fetch.recurseSubmodules", "false")
						.pipe(Effect.mapError(asSubmoduleError("git config fetch.recurseSubmodules false", root)));

					for (const [name, entry] of Object.entries(manifest.repos)) {
						const repoPath = path.join(root, REPOS_DIR, name);
						const repoPathRel = `${REPOS_DIR}/${name}`;
						const moduleDir = yield* resolveModuleDir(fs, path, root, name);

						yield* lockdown.withUnlocked(
							root,
							name,
							Effect.gen(function* () {
								// The boundary marker is asserted at the END of this block,
								// but git consults it DURING it: `submodule.<name>.update =
								// none` makes `git submodule update --init` skip the
								// submodule outright ("Skipping submodule ..."), which would
								// silently defeat this method's own initialize branch below.
								// `--checkout` overrides `none` on the command line, but
								// `@effected/git`'s `submoduleUpdate` exposes no such option
								// (kit gap), so neutralize the marker for the duration of our
								// own git work and re-assert it at the end. A crash in
								// between leaves `checkout`, i.e. plain git default behavior
								// — the pre-marker status quo, never something worse.
								//
								// Keyed on the repo-relative PATH because that is the name
								// `git submodule add` derives its `.gitmodules` section from,
								// and the name `rename` canonicalizes a diverged section back
								// to; a checkout whose local registration still carries an
								// older name is exactly the divergence `ReposDrift` reports.
								const updateKey = `submodule.${repoPathRel}.update`;
								yield* git
									.configSet(root, updateKey, "checkout")
									.pipe(Effect.mapError(asSubmoduleError(`git config ${updateKey} checkout`, root)));

								let clearedAnyLock = false;
								for (const lock of STALE_LOCKS) {
									const lockPath = path.join(moduleDir, lock);
									// `Effect.option` folds "absent" and "stat failed" into the same
									// `None` outcome: either way there's nothing this pass can
									// safely remove.
									const info = yield* fs.stat(lockPath).pipe(Effect.option);
									if (Option.isNone(info)) {
										continue;
									}
									const mtime = info.value.mtime;
									if (Option.isNone(mtime)) {
										// Age is undeterminable on this filesystem; leave it alone.
										continue;
									}
									const now = yield* Clock.currentTimeMillis;
									const age = now - mtime.value.getTime();
									if (age < STALE_LOCK_MAX_AGE_MS) {
										// Young enough that an active git process may still hold it.
										continue;
									}
									const removed = yield* fs
										.remove(lockPath)
										.pipe(Effect.match({ onSuccess: () => true, onFailure: () => false }));
									if (removed) {
										clearedAnyLock = true;
									}
								}
								if (clearedAnyLock) {
									clearedLocks.push(name);
								}

								const present = yield* isPresent(repoPath);

								// A `.gitmodules` section exists whenever a prior `add` (or
								// hand-run `git submodule add`) already registered this path,
								// even if the worktree itself is currently absent (the
								// `simulatePriorAdd` shape every other test in this suite
								// relies on). Only a manifest entry with NEITHER a worktree
								// NOR a `.gitmodules` section is a true orphan that needs
								// registering from scratch.
								const gitmodulesText = yield* fs.readFileString(gitmodulesPath).pipe(Effect.option);
								let gitmodulesEntry: GitmodulesEntry | undefined;
								if (Option.isSome(gitmodulesText)) {
									const parsed = yield* Gitmodules.parse(gitmodulesText.value).pipe(
										Effect.mapError(asSubmoduleError("parse .gitmodules", gitmodulesPath)),
									);
									gitmodulesEntry = parsed.entries.find((candidate) => candidate.path === repoPathRel);
								}

								if (present && gitmodulesEntry) {
									const currentUrl = yield* git
										.configGet(repoPath, "remote.origin.url")
										.pipe(Effect.mapError(asSubmoduleError("git config --get remote.origin.url", repoPath)));

									if (Option.isSome(currentUrl) && currentUrl.value !== entry.url) {
										const configResult = GitConfig.parseResult(Option.getOrThrow(gitmodulesText));
										if (Result.isFailure(configResult)) {
											return yield* Effect.fail(
												asSubmoduleError("parse .gitmodules", gitmodulesPath)(configResult.failure),
											);
										}
										const setResult = Gitmodules.setUrl(configResult.success, gitmodulesEntry.name, entry.url);
										if (Result.isFailure(setResult)) {
											return yield* Effect.fail(
												asSubmoduleError(
													`gitmodules set-url ${gitmodulesEntry.name}`,
													gitmodulesPath,
												)(setResult.failure),
											);
										}
										yield* fs
											.writeFileString(gitmodulesPath, setResult.success.stringify())
											.pipe(Effect.mapError(asSubmoduleError("write .gitmodules", gitmodulesPath)));
										yield* git
											.submoduleSync(root, { paths: [repoPathRel] })
											.pipe(Effect.mapError(asSubmoduleError(`git submodule sync -- ${repoPathRel}`, root)));
										urlSynced.push(name);
									} else {
										upToDate.push(name);
									}
								} else if (!present && !gitmodulesEntry) {
									yield* git
										.submoduleAdd(root, { url: entry.url, path: repoPathRel, depth: 1 })
										.pipe(
											Effect.mapError(
												asSubmoduleError(`git submodule add --depth 1 ${entry.url} ${repoPathRel}`, root),
											),
										);
									yield* git
										.configSet(root, `submodule.${repoPathRel}.shallow`, "true", { file: ".gitmodules" })
										.pipe(
											Effect.mapError(
												asSubmoduleError(`git config -f .gitmodules submodule.${repoPathRel}.shallow true`, root),
											),
										);

									yield* fetchRef(repoPath, entry.ref);
									yield* git
										.checkout(repoPath, "FETCH_HEAD", { detach: true })
										.pipe(Effect.mapError(asSubmoduleError("git checkout --detach FETCH_HEAD", repoPath)));

									yield* git
										.add(root, [".gitmodules", repoPathRel])
										.pipe(Effect.mapError(asSubmoduleError(`git add .gitmodules ${repoPathRel}`, root)));

									registered.push(name);
								} else if (!present) {
									yield* git
										.submoduleUpdate(root, { init: true, depth: 1, paths: [repoPathRel] })
										.pipe(
											Effect.mapError(
												asSubmoduleError(`git submodule update --init --depth 1 -- ${repoPathRel}`, root),
											),
										);
									initialized.push(name);
								} else {
									upToDate.push(name);
								}

								if (entry.sparse && entry.sparse.length > 0) {
									// Evict any of the vendored repo's OWN submodules first,
									// or `sparseApplied` reports a lie: sparse-checkout
									// governs the parent's tracked files only, so a
									// materialized nested submodule survives the call below
									// untouched no matter what the manifest's `sparse` list
									// says. Reporting `sparseApplied` for a repo whose
									// excluded directories are still on disk is exactly the
									// false success this field was accused of.
									const nested = yield* git.submoduleStatus(repoPath).pipe(Effect.orElseSucceed(() => []));
									if (nested.some((nestedEntry) => nestedEntry.state !== "uninitialized")) {
										yield* git
											.submoduleDeinit(repoPath, { all: true, force: true })
											.pipe(Effect.mapError(asSubmoduleError("git submodule deinit --all --force", repoPath)));
									}

									yield* git
										.sparseCheckoutSet(repoPath, entry.sparse, { cone: false })
										.pipe(Effect.mapError(asSubmoduleError("git sparse-checkout set --no-cone", repoPath)));
									sparseApplied.push(name);
								}

								// Assert the boundary now that our own git work is done:
								// `update = none` makes every client — `git submodule
								// update`, `git pull --recurse-submodules`, and the GUI
								// clients that drive them — skip this tree instead of
								// managing it. This is the declarative statement of a
								// posture that used to be communicated only by an `EACCES`
								// on a locked gitdir.
								//
								// `submodule.<name>.active` is deliberately NOT set to
								// `false`, though it reads like the natural companion:
								// `git submodule status` reports an inactive submodule as
								// UNINITIALIZED even when it is fully checked out, which
								// would make `ReposDrift` report `missingWorktree` for every
								// vendored repo — and `git submodule init` (which `rename`
								// runs) flips it back to `true` anyway, so the marker would
								// not even survive this package's own operations.
								yield* git
									.configSet(root, updateKey, "none")
									.pipe(Effect.mapError(asSubmoduleError(`git config ${updateKey} none`, root)));
								boundaryMarked.push(name);
							}),
						);
					}

					return { initialized, sparseApplied, upToDate, clearedLocks, urlSynced, registered, boundaryMarked };
				});

			/** Last path segment of a repo URL, with a trailing `.git` stripped. */
			const repoSlug = (url: string): string => {
				const last =
					url
						.split("/")
						.filter((segment) => segment.length > 0)
						.pop() ?? url;
				return last.endsWith(".git") ? last.slice(0, -".git".length) : last;
			};

			/**
			 * Fetch `ref` shallow into a submodule via the kit's `Git.fetchAny`:
			 * tag-form fetch first (tags need the explicit `fetch origin tag <ref>`
			 * form), falling back to a plain `fetch origin <ref>` on
			 * `UnknownRefError` OR `GitCommandError` (unclassified tag-form stderr
			 * keeps the v3 any-failure fallback). `NotARepositoryError` deliberately
			 * does NOT fall back — a plain fetch in a non-repo fails identically, so
			 * retrying only doubled the latency of a certain failure. When both
			 * attempts fail, the plain fetch's error surfaces.
			 */
			const fetchRef = (sub: string, ref: string): Effect.Effect<void, GitSubmoduleError> =>
				git
					.fetchAny(sub, { ref, depth: 1 })
					.pipe(Effect.mapError(asSubmoduleError(`git fetch --depth 1 origin ${ref}`, sub)));

			const add = (
				root: string,
				options: {
					readonly url: string;
					readonly ref: string;
					readonly purpose: string;
					readonly name?: string;
					readonly sparse?: ReadonlyArray<string>;
					readonly orientation?: RepoOrientation;
				},
			) =>
				Effect.gen(function* () {
					const name = options.name ?? repoSlug(options.url);

					// 1. Validate the effective name BEFORE any side effect — a bad
					// name (path traversal, separators, "." or "..") must never reach
					// git or the filesystem.
					yield* Schema.decodeUnknownEffect(RepoName)(name).pipe(
						Effect.mapError(
							() =>
								new ReposConfigError({
									path: MANIFEST_PATH,
									reason: `invalid repo name "${name}": must be non-empty, contain no "/" or "\\", and not be "." or ".."`,
									kind: "invalid",
								}),
						),
					);

					// 2. Read the manifest, treating "no manifest yet" as empty. Only a
					// read that reports kind "missing" is read as absence — any other
					// failure (stat failure, invalid JSON, schema violation)
					// propagates, so a transient I/O error can never be silently
					// reinitialized over a real manifest.
					const manifest: ReposManifestFile = yield* configStore
						.read(root)
						.pipe(
							Effect.catchTag("ReposConfigError", (error) =>
								error.kind === "missing" ? Effect.succeed({ repos: {} } as ReposManifestFile) : Effect.fail(error),
							),
						);

					// 3. Reject a duplicate name before touching git.
					if (getRepoEntry(manifest.repos, name)) {
						return yield* Effect.fail(
							new ReposConfigError({
								path: MANIFEST_PATH,
								reason: `"${name}" is already vendored — use pin to change its ref`,
								kind: "invalid",
							}),
						);
					}

					const repoPath = `${REPOS_DIR}/${name}`;
					const subPath = path.join(root, repoPath);

					// 4. Validate the requested ref against the remote BEFORE any
					// mutation: an unknown ref must fail with no gitlink in the index,
					// no `.gitmodules` change, and no worktree. Auth/unreachable-remote
					// failures stay whatever `asSubmoduleError` classifies from the
					// underlying `GitCommandError` — no dedicated catch arm.
					const remoteRefs = yield* git
						.lsRemote(root, options.url, { heads: true, tags: true })
						.pipe(Effect.mapError(asSubmoduleError(`git ls-remote --heads --tags ${options.url}`, root)));
					const refMatched = remoteRefs.some((remoteRef) => LsRemoteEntry.shortName(remoteRef.ref) === options.ref);
					if (!refMatched) {
						const suggestionNames = LsRemoteEntry.nearMatches(remoteRefs, options.ref).map((match) =>
							LsRemoteEntry.shortName(match.ref),
						);
						const suggestions = [...new Set(suggestionNames)].slice(0, 5);
						const reason =
							suggestions.length > 0
								? `ref "${options.ref}" not found at ${options.url}; did you mean: ${suggestions.join(", ")}?`
								: `ref "${options.ref}" not found at ${options.url}`;
						return yield* Effect.fail(
							new GitSubmoduleError({ command: `git ls-remote --heads --tags ${options.url}`, cwd: root, reason }),
						);
					}

					const gitmodulesPath = path.join(root, ".gitmodules");

					yield* lockdown.withUnlocked(
						root,
						name,
						Effect.gen(function* () {
							// 5. Detect a resumable partial state: a prior `add` that
							// registered the gitlink (staged in the index) and the
							// `.gitmodules` section, then died before fetch/checkout. Same
							// path + same url resumes by skipping `submodule add`; same
							// path + a DIFFERENT url is a genuine conflict and fails typed
							// rather than silently overwriting someone else's partial work.
							const gitmodulesTextOption = yield* fs.readFileString(gitmodulesPath).pipe(Effect.option);
							let existingGitmodulesEntry: GitmodulesEntry | undefined;
							if (Option.isSome(gitmodulesTextOption)) {
								const parsedGitmodules = yield* Gitmodules.parse(gitmodulesTextOption.value).pipe(
									Effect.mapError(asSubmoduleError("parse .gitmodules", gitmodulesPath)),
								);
								existingGitmodulesEntry = parsedGitmodules.entries.find((candidate) => candidate.path === repoPath);
							}
							const stagedEntries = yield* git
								.lsFiles(root, { pathspec: [repoPath] })
								.pipe(Effect.mapError(asSubmoduleError(`git ls-files --stage -- ${repoPath}`, root)));
							const gitlinkStaged = stagedEntries.some((stagedEntry) => stagedEntry.mode === "160000");

							let resuming = false;
							if (existingGitmodulesEntry && gitlinkStaged) {
								if (existingGitmodulesEntry.url !== options.url) {
									return yield* Effect.fail(
										new ReposConfigError({
											path: gitmodulesPath,
											reason: `"${name}" already has a partial submodule at ${repoPath} registered to a different url (${existingGitmodulesEntry.url}) than requested (${options.url}) — resolve the conflict manually before retrying add`,
											kind: "invalid",
										}),
									);
								}
								resuming = true;
							}

							// 6. Rollback: any failure from this point undoes the gitlink,
							// the worktree, the module gitdir, and the `.gitmodules`
							// section — restoring pre-add state. Each step's failure is
							// logged (`Effect.logWarning`) and swallowed independently, so
							// one step failing never skips the rest of the rollback; the
							// ORIGINAL failure always propagates once rollback finishes.
							const rollbackStep = <RA, RE>(step: string, effect: Effect.Effect<RA, RE>): Effect.Effect<void> =>
								effect.pipe(
									Effect.asVoid,
									Effect.catch((rollbackError) =>
										Effect.logWarning(`repos add rollback for "${name}" — ${step} failed: ${String(rollbackError)}`),
									),
								);

							// The rollback-guarded block below only ever fails with
							// `GitSubmoduleError` (`submoduleAdd`/`configSet`/`fetchRef`/
							// `checkout`/`sparseCheckoutSet` all map onto it) -- the
							// resumable-partial-state `ReposConfigError` conflict check
							// above already returned before this point, so it never
							// reaches this handler.
							const rollback = (cause: GitSubmoduleError): Effect.Effect<never, GitSubmoduleError> =>
								Effect.gen(function* () {
									// Resolve the module gitdir FIRST, while the worktree's `.git`
									// pointer file still exists: `git submodule deinit --force`
									// clears the worktree (the pointer file included), so reading
									// it after deinit always silently degrades to the name-based
									// fallback — inert for a fresh add (name === registration
									// name), but live through the resumable branch, where a
									// divergently-named prior registration would leave its real
									// `.git/modules/<other>` gitdir orphaned while rollback reports
									// clean.
									const moduleDir = yield* resolveModuleDir(fs, path, root, name);
									yield* rollbackStep(
										"submodule deinit",
										git.submoduleDeinit(root, { paths: [repoPath], force: true }),
									);
									yield* rollbackStep("rm --cached", git.rm(root, [repoPath], { cached: true }));
									yield* rollbackStep("remove worktree", fs.remove(subPath, { recursive: true, force: true }));
									yield* rollbackStep("remove module gitdir", fs.remove(moduleDir, { recursive: true, force: true }));

									const currentGitmodulesText = yield* fs.readFileString(gitmodulesPath).pipe(Effect.option);
									if (Option.isSome(currentGitmodulesText)) {
										const parsedForRollback = yield* Gitmodules.parse(currentGitmodulesText.value).pipe(Effect.option);
										// `git submodule add` names the `.gitmodules` section after the
										// PATH ([submodule ".repos/<name>"]), not the bare manifest key --
										// removing by `name` alone was a no-op that left the section (and
										// a wedged next `add`) behind. Resolve the section the same way
										// `remove`'s own `.gitmodules` cleanup does: by canonical name
										// first, falling back to its `path` field, both matched against
										// `repoPath` (the actual registered path).
										const section = Option.isSome(parsedForRollback)
											? (parsedForRollback.value.entries.find((candidate) => candidate.name === repoPath) ??
												parsedForRollback.value.entries.find((candidate) => candidate.path === repoPath))
											: undefined;
										if (section) {
											const configResult = GitConfig.parseResult(currentGitmodulesText.value);
											if (Result.isSuccess(configResult)) {
												const removeResult = Gitmodules.remove(configResult.success, section.name);
												if (Result.isSuccess(removeResult)) {
													yield* rollbackStep(
														"restore .gitmodules",
														fs.writeFileString(gitmodulesPath, removeResult.success.stringify()),
													);
												}
											}
										}
									}
								}).pipe(Effect.andThen(Effect.fail(cause)));

							yield* Effect.gen(function* () {
								if (!resuming) {
									yield* git
										.submoduleAdd(root, { url: options.url, path: repoPath, depth: 1 })
										.pipe(
											Effect.mapError(asSubmoduleError(`git submodule add --depth 1 ${options.url} ${repoPath}`, root)),
										);
								}
								yield* git
									.configSet(root, `submodule.${repoPath}.shallow`, "true", { file: ".gitmodules" })
									.pipe(
										Effect.mapError(
											asSubmoduleError(`git config -f .gitmodules submodule.${repoPath}.shallow true`, root),
										),
									);

								yield* fetchRef(subPath, options.ref);
								yield* git
									.checkout(subPath, "FETCH_HEAD", { detach: true })
									.pipe(Effect.mapError(asSubmoduleError("git checkout --detach FETCH_HEAD", subPath)));

								if (options.sparse && options.sparse.length > 0) {
									yield* git
										.sparseCheckoutSet(subPath, options.sparse, { cone: false })
										.pipe(Effect.mapError(asSubmoduleError("git sparse-checkout set --no-cone", subPath)));
								}
							}).pipe(Effect.catch(rollback));
						}),
					);

					// Declare the boundary at the point the tree comes into existence,
					// not at the next `sync`. `add` is a creation point: leaving the
					// marker to a later run means a freshly vendored repo sits
					// undeclared in the meantime, and every client is free to manage
					// it — which is exactly the window this marker exists to close.
					// (Found by re-vendoring this repo's own `effect` entry and
					// noticing the marker was absent afterwards.)
					//
					// Unlike `sync`, no flip to `checkout` is needed around the git
					// work above: nothing in `add` runs `git submodule update`, which
					// is the only command `update = none` suppresses.
					yield* git
						.configSet(root, "fetch.recurseSubmodules", "false")
						.pipe(Effect.mapError(asSubmoduleError("git config fetch.recurseSubmodules false", root)));
					yield* git
						.configSet(root, `submodule.${repoPath}.update`, "none")
						.pipe(Effect.mapError(asSubmoduleError(`git config submodule.${repoPath}.update none`, root)));

					const entry: RepoEntry = {
						url: options.url,
						ref: options.ref,
						purpose: options.purpose,
						...(options.sparse && options.sparse.length > 0 ? { sparse: options.sparse } : {}),
						...(options.orientation ? { orientation: options.orientation } : {}),
					};

					// 7. The manifest write moves onto the serialized `update` primitive
					// so a concurrent writer can never lose this entry.
					yield* configStore.update(root, (fresh) => ({ repos: { ...fresh.repos, [name]: entry } }));

					yield* git
						.add(root, [".gitmodules", MANIFEST_PATH, repoPath])
						.pipe(Effect.mapError(asSubmoduleError(`git add .gitmodules ${MANIFEST_PATH} ${repoPath}`, root)));

					return { name, ref: options.ref, path: repoPath };
				});

			const pin = (root: string, name: string, ref: string) =>
				Effect.gen(function* () {
					const manifest = yield* configStore.read(root);
					const entry = getRepoEntry(manifest.repos, name);
					if (!entry) {
						return yield* Effect.fail(new RepoNotFoundError({ name }));
					}

					const repoPath = `${REPOS_DIR}/${name}`;
					const subPath = path.join(root, repoPath);

					const { oldCommit, newCommit } = yield* lockdown.withUnlocked(
						root,
						name,
						Effect.gen(function* () {
							// `orElseSucceed(() => null)` covers "no HEAD yet" (a fresh
							// checkout with nothing committed) — reading this INSIDE the
							// unlock scope means a real permission failure surfaces as
							// `ReposLockdownError` from the unlock walk rather than being
							// masked as a false "no HEAD" null.
							const oldCommit = yield* git.revParse(subPath, "HEAD").pipe(Effect.orElseSucceed(() => null));

							yield* fetchRef(subPath, ref);
							yield* git
								.checkout(subPath, "FETCH_HEAD", { detach: true })
								.pipe(Effect.mapError(asSubmoduleError("git checkout --detach FETCH_HEAD", subPath)));
							const newCommit = yield* git
								.revParse(subPath, "HEAD")
								.pipe(Effect.mapError(asSubmoduleError("git rev-parse HEAD", subPath)));

							return { oldCommit, newCommit };
						}),
					);

					// The manifest write rides the lock-serialized `update` like every
					// other mutating op (pin was the last one on the unlocked `write`
					// path), and the entry is re-read INSIDE the lock so a concurrent
					// mutation between the up-front existence check and this write
					// surfaces as a typed failure instead of a lost update.
					yield* configStore.update(root, (fresh) => {
						const freshEntry = getRepoEntry(fresh.repos, name);
						if (!freshEntry) {
							return Effect.fail(
								new ReposConfigError({
									path: path.join(root, MANIFEST_PATH),
									reason: `pin applied to git but manifest entry "${name}" is gone; manifest and checkout now disagree`,
									kind: "invalid",
								}),
							);
						}
						return Effect.succeed({
							repos: { ...fresh.repos, [name]: { ...freshEntry, ref } },
						});
					});

					// `.gitmodules` is not written by this method — pin only moves the
					// submodule's ref — but the working tree may already carry an
					// out-of-band edit to it (e.g. a hand-applied URL fix) that would
					// otherwise be left unstaged alongside the ref bump this method DOES
					// stage. `git status --porcelain` is the ground truth for "currently
					// modified"; stage `.gitmodules` only when it actually reports one.
					const rootStatus = yield* git
						.status(root)
						.pipe(Effect.mapError(asSubmoduleError("git status --porcelain", root)));
					const gitmodulesChanged = rootStatus.some((s) => s.path === ".gitmodules");

					yield* git
						.add(root, gitmodulesChanged ? [MANIFEST_PATH, repoPath, ".gitmodules"] : [MANIFEST_PATH, repoPath])
						.pipe(
							Effect.mapError(
								asSubmoduleError(
									gitmodulesChanged
										? `git add ${MANIFEST_PATH} ${repoPath} .gitmodules`
										: `git add ${MANIFEST_PATH} ${repoPath}`,
									root,
								),
							),
						);

					const staleNoteIds = (entry.notes ?? []).filter((note) => note.ref !== ref).map((note) => note.id);
					const commitMessage = `chore(repos): pin ${name} to ${ref}`;

					return { name, ref, oldCommit, newCommit, commitMessage, staleNoteIds };
				});

			const note = (
				root: string,
				name: string,
				op:
					| { readonly op: "add"; readonly note: string }
					| { readonly op: "remove"; readonly id: string }
					| { readonly op: "promote"; readonly id: string; readonly into: "layout" | "startHere" },
			) =>
				Effect.gen(function* () {
					const manifest = yield* configStore.read(root);
					const entry = getRepoEntry(manifest.repos, name);
					if (!entry) {
						return yield* Effect.fail(new RepoNotFoundError({ name }));
					}

					const notes = entry.notes ?? [];

					if (op.op === "add") {
						if (notes.length >= NOTE_LIMIT) {
							return yield* Effect.fail(
								new ReposConfigError({
									path: MANIFEST_PATH,
									reason: `note limit (${NOTE_LIMIT}) reached for ${name}; promote or remove notes first`,
									kind: "invalid",
								}),
							);
						}

						const existingIds = new Set(notes.map((existing) => existing.id));
						const hash = createHash("sha256").update(op.note).digest("hex");

						// Extend the slice length (4, 8, 12, ... up to the full 64-hex
						// digest) until it lands on an id not already in use. A third
						// (or later) note with byte-identical text hashes to the same
						// digest as its predecessors, so a fixed 4-then-8 extension
						// collides again on the third add; walking the full digest space
						// keeps every distinct slot in `notes` distinct.
						let id: string | undefined;
						for (let len = 4; len <= hash.length; len += 4) {
							const candidate = `n-${hash.slice(0, len)}`;
							if (!existingIds.has(candidate)) {
								id = candidate;
								break;
							}
						}
						if (id === undefined) {
							// Even the full digest collides -- true duplicate note text with
							// every prior slot already occupied. Fall back to a numeric
							// counter suffix so the id still stays unique.
							let counter = 2;
							let candidate = `n-${hash}-${counter}`;
							while (existingIds.has(candidate)) {
								counter += 1;
								candidate = `n-${hash}-${counter}`;
							}
							id = candidate;
						}

						const millis = yield* Clock.currentTimeMillis;
						const date = new Date(millis).toISOString().slice(0, 10);

						const newNote: RepoNote = { id, date, ref: entry.ref, note: op.note };
						const updatedNotes = [...notes, newNote];
						const updatedEntry: RepoEntry = { ...entry, notes: updatedNotes };
						yield* configStore.update(root, (fresh) => ({ repos: { ...fresh.repos, [name]: updatedEntry } }));

						return { name, op: "add" as const, id, noteCount: updatedNotes.length };
					}

					const target = notes.find((existing) => existing.id === op.id);
					if (!target) {
						return yield* Effect.fail(new NoteNotFoundError({ name, id: op.id }));
					}
					const updatedNotes = notes.filter((existing) => existing.id !== op.id);

					if (op.op === "remove") {
						const updatedEntry: RepoEntry = { ...entry, notes: updatedNotes };
						yield* configStore.update(root, (fresh) => ({ repos: { ...fresh.repos, [name]: updatedEntry } }));
						return { name, op: "remove" as const, id: op.id, noteCount: updatedNotes.length };
					}

					// A prior promotion into the same field must not be clobbered: append
					// with a blank-line paragraph break rather than overwrite (#377 —
					// promoting a second note into `layout` used to destroy the first).
					const existing = entry.orientation?.[op.into];
					const promoted = existing === undefined ? target.note : `${existing}\n\n${target.note}`;
					const updatedOrientation: RepoOrientation = { ...entry.orientation, [op.into]: promoted };
					const updatedEntry: RepoEntry = { ...entry, orientation: updatedOrientation, notes: updatedNotes };
					yield* configStore.update(root, (fresh) => ({ repos: { ...fresh.repos, [name]: updatedEntry } }));
					return { name, op: "promote" as const, id: op.id, noteCount: updatedNotes.length };
				});

			const remove = (root: string, name: string) =>
				Effect.gen(function* () {
					const manifest = yield* configStore.read(root);
					const entry = getRepoEntry(manifest.repos, name);
					if (!entry) {
						return yield* Effect.fail(new RepoNotFoundError({ name }));
					}

					const repoPath = `${REPOS_DIR}/${name}`;
					const subPath = path.join(root, repoPath);

					// Resolve the module gitdir FIRST, while the worktree's `.git`
					// pointer file still exists -- `git submodule deinit --force`
					// clears the worktree (the pointer file included), so reading it
					// after deinit always silently degrades to the name-based
					// fallback (the Task 9 rollback lesson, baked in from the start
					// here rather than learned the hard way again).
					const moduleDir = yield* resolveModuleDir(fs, path, root, name);

					yield* lockdown.withUnlocked(
						root,
						name,
						Effect.gen(function* () {
							yield* git
								.submoduleDeinit(root, { paths: [repoPath], force: true })
								.pipe(Effect.mapError(asSubmoduleError(`git submodule deinit --force -- ${repoPath}`, root)));
							yield* git
								.rm(root, [repoPath], { cached: true })
								.pipe(Effect.mapError(asSubmoduleError(`git rm --cached ${repoPath}`, root)));

							// After these two, the tree is already partially gone --
							// `withUnlocked`'s relock walk over a now-missing directory
							// is a silent success (see `walkRoot`'s `present` guard), so
							// removing the worktree and gitdir here, still inside the
							// unlock bracket, is safe.
							yield* fs
								.remove(subPath, { recursive: true, force: true })
								.pipe(
									Effect.mapError(
										(cause) =>
											new GitSubmoduleError({ command: "remove worktree", cwd: subPath, reason: String(cause) }),
									),
								);
							yield* fs
								.remove(moduleDir, { recursive: true, force: true })
								.pipe(
									Effect.mapError(
										(cause) =>
											new GitSubmoduleError({ command: "remove module gitdir", cwd: moduleDir, reason: String(cause) }),
									),
								);
						}),
					);

					// `.gitmodules`: the section name may diverge from the manifest
					// key (a repo re-slugged after its section was created) -- find the
					// section by its canonical name first, falling back to its
					// `path` field, mirroring the drift-pairing logic in
					// `drift.ts`.
					const gitmodulesPath = path.join(root, ".gitmodules");
					const gitmodulesText = yield* fs
						.readFileString(gitmodulesPath)
						.pipe(Effect.mapError(asSubmoduleError("read .gitmodules", gitmodulesPath)));
					const parsedGitmodules = yield* Gitmodules.parse(gitmodulesText).pipe(
						Effect.mapError(asSubmoduleError("parse .gitmodules", gitmodulesPath)),
					);
					const section =
						parsedGitmodules.entries.find((candidate) => candidate.name === repoPath) ??
						parsedGitmodules.entries.find((candidate) => candidate.path === repoPath);
					if (!section) {
						return yield* Effect.fail(
							new ReposConfigError({
								path: gitmodulesPath,
								reason: `no .gitmodules section found for "${name}" (looked for name or path "${repoPath}")`,
								kind: "invalid",
							}),
						);
					}

					const configResult = GitConfig.parseResult(gitmodulesText);
					if (Result.isFailure(configResult)) {
						return yield* Effect.fail(asSubmoduleError("parse .gitmodules", gitmodulesPath)(configResult.failure));
					}
					const removeResult = Gitmodules.remove(configResult.success, section.name);
					if (Result.isFailure(removeResult)) {
						return yield* Effect.fail(
							asSubmoduleError(`gitmodules remove ${section.name}`, gitmodulesPath)(removeResult.failure),
						);
					}
					yield* fs
						.writeFileString(gitmodulesPath, removeResult.success.stringify())
						.pipe(Effect.mapError(asSubmoduleError("write .gitmodules", gitmodulesPath)));

					yield* configStore.update(root, (fresh) => {
						const { [name]: _dropped, ...rest } = fresh.repos;
						return { repos: rest };
					});

					// `path` itself is deliberately NOT re-added here: `git rm --cached`
					// above already stages its removal from the index the instant it
					// runs, and by this point the worktree is physically gone too, so
					// re-adding a path that exists in neither the index nor the disk
					// fails typed (`fatal: pathspec ... did not match any files`).
					yield* git
						.add(root, [".gitmodules", MANIFEST_PATH])
						.pipe(Effect.mapError(asSubmoduleError(`git add .gitmodules ${MANIFEST_PATH}`, root)));

					return {
						name,
						path: repoPath,
						commitMessage: `chore(repos): remove ${name}`,
						removedNotes: entry.notes ?? [],
						// The entry as it stood, so a remove-then-re-add remedy can hand
						// `orientation` straight back to `add` instead of losing it.
						removedEntry: entry,
					};
				});

			const rename = (root: string, oldName: string, newName: string) =>
				Effect.gen(function* () {
					const manifest = yield* configStore.read(root);
					if (!getRepoEntry(manifest.repos, oldName)) {
						return yield* Effect.fail(new RepoNotFoundError({ name: oldName }));
					}

					// Validate the target name BEFORE any side effect -- a bad name
					// (path traversal, separators, "." or "..") must never reach git
					// or the filesystem, same discipline as `add`.
					yield* Schema.decodeUnknownEffect(RepoName)(newName).pipe(
						Effect.mapError(
							() =>
								new ReposConfigError({
									path: MANIFEST_PATH,
									reason: `invalid repo name "${newName}": must be non-empty, contain no "/" or "\\", and not be "." or ".."`,
									kind: "invalid",
								}),
						),
					);
					if (getRepoEntry(manifest.repos, newName)) {
						return yield* Effect.fail(
							new ReposConfigError({
								path: MANIFEST_PATH,
								reason: `"${newName}" is already vendored — choose a different name`,
								kind: "invalid",
							}),
						);
					}

					const oldRepoPath = `${REPOS_DIR}/${oldName}`;
					const newRepoPath = `${REPOS_DIR}/${newName}`;
					const gitmodulesPath = path.join(root, ".gitmodules");

					// Resolve the module gitdir FIRST, while the worktree's `.git`
					// pointer file still lives at the OLD path (the Task 9/10
					// lesson, baked in from the start here too). The module dir's
					// disk location is deliberately NOT moved by this method (see
					// the bracketing note below) -- only the worktree moves -- so
					// this same `moduleDir` value stays valid across the whole
					// operation.
					const moduleDir = yield* resolveModuleDir(fs, path, root, oldName);

					// Bracketing design: `withUnlocked` can't be reused verbatim
					// here because the tree it unlocks is named `oldName` (worktree
					// present, `.git` pointer readable) but the tree that needs
					// relocking afterward is named `newName` (post-`mv`, the
					// worktree only exists at the new path — `resolveModuleDir`
					// keyed on `oldName` would find nothing there and silently
					// degrade to a name-based fallback that happens to still
					// resolve the module dir correctly by coincidence, but the
					// worktree half of the lock walk would find nothing to lock).
					// So this hand-rolls the same uninterruptible-mask contract
					// `withUnlocked` uses (unlock, run the effect, relock is always
					// attempted, an inner/unlock failure always wins over a relock
					// failure), but tracks a mutable `lockName` that starts as
					// `oldName` and flips to `newName` the instant `git mv`
					// succeeds — so a failure BEFORE the move relocks the
					// (unmoved) old tree and a failure AFTER it relocks the
					// (moved) new tree, and the happy path always ends locked
					// under `newName`. One deliberate divergence from
					// `withUnlocked` itself: that helper returns the inner
					// effect's success value through the bracket, but this one
					// doesn't need to — the caller builds the `ReposRenameResult`
					// itself from `oldName`/`newName`/`newRepoPath` after the
					// bracket resolves, so the inner generator's `Effect.gen`
					// here is typed `void` throughout.
					yield* Effect.uninterruptibleMask((restore) =>
						Effect.gen(function* () {
							const unlockExit = yield* Effect.exit(lockdown.unlock(root, oldName));
							let lockName = oldName;

							const resultExit: Exit.Exit<void, GitSubmoduleError | ReposConfigError | ReposLockdownError> =
								Exit.isFailure(unlockExit)
									? Exit.failCause(unlockExit.cause)
									: yield* Effect.exit(
											restore(
												Effect.gen(function* () {
													// a. `git mv` moves the worktree, updates the index (a
													// staged rename) and, per the Task 11 real-git probe
													// against git 2.54, ALSO rewrites `.gitmodules`' `path`
													// field and stages it, and recomputes the module's own
													// `core.worktree` -- so none of those three are redone
													// by hand below; only what git leaves broken is fixed.
													yield* git
														.mv(root, oldRepoPath, newRepoPath)
														.pipe(Effect.mapError(asSubmoduleError(`git mv ${oldRepoPath} ${newRepoPath}`, root)));
													lockName = newName;

													// b. Defensive idempotent re-assertion of `core.worktree`
													// in the module's main config -- the probe found `git
													// mv` already gets this right, but #377's regression was
													// exactly this value going stale, so this pins the
													// invariant rather than trusting a future git version to
													// keep doing it.
													//
													// Both writes below target `configSet`'s `cwd` at `root`
													// (a known-healthy repo) with an ABSOLUTE `-f` path into
													// the module dir, deliberately never at `cwd: moduleDir`.
													// A second real-git probe (this review round) found that
													// invoking `git -C <moduleDir> config ...` fails outright
													// -- "cannot chdir to '<stale value>'" -- whenever
													// `extensions.worktreeConfig` is set: git's own repository
													// discovery from inside `moduleDir` reads `config.worktree`
													// BEFORE running any subcommand, and `config.worktree`
													// (never touched by `mv`) still names the OLD worktree
													// directory, which `mv` has already physically relocated
													// out from under it -- a `config.worktree`, when present,
													// is therefore ALWAYS broken immediately after `mv`, not
													// merely coincidentally stale. Chicken-and-egg: cwd inside
													// the broken module dir can't fix the very value breaking
													// that cwd. Routing through `root` sidesteps discovery
													// inside `moduleDir` entirely, so `configSet` reliably
													// targets both files -- no raw-fs `GitConfig` fallback is
													// needed for either.
													//
													// The VALUE written matters just as much as the invocation
													// shape (a live-repo rename caught this, systems#363-shaped
													// -- `git status` died repo-wide with `cannot chdir to
													// '.repos/effect'`): git resolves a relative `core.worktree`
													// relative to the GITDIR, not to the repo root or the
													// process cwd. A naive `path.join(root, newRepoPath)` is
													// only correct when `root` itself happens to already be
													// absolute -- `path.join` never normalizes a relative
													// first segment, so a caller passing a relative root (the
													// CLI's `--cwd` flag defaults to literal `"."`) produces
													// exactly the bare repo-relative value that broke the live
													// repo. `path.resolve(root, newRepoPath)` first forces an
													// OS-absolute destination (resolving against
													// `process.cwd()` when `root` is relative, matching every
													// other relative-root caller in this codebase), and
													// `path.relative(moduleDir, ...)` from there converts it
													// into the GITDIR-relative form git itself writes when it
													// recomputes the main config's `core.worktree` on `mv`
													// (Task 11's first probe) -- chosen over a bare absolute
													// value to keep this write's shape consistent with what
													// git produces natively, rather than introduce an
													// absolute-vs-relative split between the two.
													const absoluteNewSubPath = path.resolve(root, newRepoPath);
													const worktreeValue = path.relative(moduleDir, absoluteNewSubPath);

													yield* git
														.configSet(root, "core.worktree", worktreeValue, { file: path.join(moduleDir, "config") })
														.pipe(Effect.mapError(asSubmoduleError("git config core.worktree", moduleDir)));

													const worktreeConfigPath = path.join(moduleDir, "config.worktree");
													const hasWorktreeConfig = yield* fs
														.exists(worktreeConfigPath)
														.pipe(Effect.orElseSucceed(() => false));
													if (hasWorktreeConfig) {
														yield* git
															.configSet(root, "core.worktree", worktreeValue, { file: worktreeConfigPath })
															.pipe(
																Effect.mapError(
																	asSubmoduleError("git config -f config.worktree core.worktree", moduleDir),
																),
															);
													}

													// c. `.gitmodules`: `git mv` already updated + staged the
													// section's `path` field, but the section NAME itself is
													// untouched by `mv` -- it may still be the old repo path,
													// or (the re-slugged-after-vendoring shape) a name
													// that never matched the manifest key at all. Find the
													// section by its (now current) `path` field -- the one
													// field `mv` is guaranteed to have already updated -- and
													// canonicalize the section name to the new repo path.
													const gitmodulesText = yield* fs
														.readFileString(gitmodulesPath)
														.pipe(Effect.mapError(asSubmoduleError("read .gitmodules", gitmodulesPath)));
													const parsedGitmodules = yield* Gitmodules.parse(gitmodulesText).pipe(
														Effect.mapError(asSubmoduleError("parse .gitmodules", gitmodulesPath)),
													);
													const section = parsedGitmodules.entries.find((candidate) => candidate.path === newRepoPath);
													if (!section) {
														return yield* Effect.fail(
															new ReposConfigError({
																path: gitmodulesPath,
																reason: `no .gitmodules section found for "${newName}" after mv (looked for path "${newRepoPath}")`,
																kind: "invalid",
															}),
														);
													}
													if (section.name !== newRepoPath) {
														const oldSectionName = section.name;

														const configResult = GitConfig.parseResult(gitmodulesText);
														if (Result.isFailure(configResult)) {
															return yield* Effect.fail(
																asSubmoduleError("parse .gitmodules", gitmodulesPath)(configResult.failure),
															);
														}
														const renameResult = Gitmodules.rename(configResult.success, oldSectionName, newRepoPath);
														if (Result.isFailure(renameResult)) {
															return yield* Effect.fail(
																asSubmoduleError(
																	`gitmodules rename ${oldSectionName} -> ${newRepoPath}`,
																	gitmodulesPath,
																)(renameResult.failure),
															);
														}
														yield* fs
															.writeFileString(gitmodulesPath, renameResult.success.stringify())
															.pipe(Effect.mapError(asSubmoduleError("write .gitmodules", gitmodulesPath)));
														yield* git
															.add(root, [".gitmodules"])
															.pipe(Effect.mapError(asSubmoduleError("git add .gitmodules", root)));

														// The stale OLD superproject registration (see below)
														// is only unset when there IS an old name to unset --
														// scoped to this branch since `oldSectionName` is only
														// meaningful when the section actually needed renaming.
														const unsetIfPresent = (key: string) =>
															git.configGet(root, key).pipe(
																Effect.mapError(asSubmoduleError(`git config --get ${key}`, root)),
																Effect.flatMap((current) =>
																	Option.isSome(current)
																		? git
																				.configUnset(root, key)
																				.pipe(Effect.mapError(asSubmoduleError(`git config --unset ${key}`, root)))
																		: Effect.void,
																),
															);
														yield* unsetIfPresent(`submodule.${oldSectionName}.url`);
														yield* unsetIfPresent(`submodule.${oldSectionName}.active`);
													}

													// The SUPERPROJECT's own `.git/config` submodule
													// registration (`submodule.<name>.url`/`.active` --
													// entirely distinct from `.gitmodules`, and from the
													// module's own gitdir config fixed above) is written
													// only by `submodule add`/`submodule init`, keyed by
													// section NAME -- `git mv` never touches it. Left
													// alone, it stays registered under the OLD name
													// forever, so `git submodule status` reads the
													// (perfectly healthy) renamed entry as uninitialized
													// (a live-repo post-rename finding, this review round).
													// Run UNCONDITIONALLY (not nested inside the
													// section-rename branch above) and tolerantly --
													// `submoduleInit` re-registering an already-current
													// section is a safe no-op, so this reaches the fix even
													// on a hypothetical retry that resumes after a prior run
													// already canonicalized the section name but crashed
													// before reaching this point.
													yield* git
														.submoduleInit(root, { paths: [newRepoPath] })
														.pipe(Effect.mapError(asSubmoduleError(`git submodule init -- ${newRepoPath}`, root)));

													// 3. Manifest: rename the key, entry preserved verbatim.
													// A concurrent manifest mutation (another `remove`/
													// `rename`/hand-edit) landing in the narrow window
													// between this method's up-front `configStore.read`
													// existence check and this `update` call -- the lock is
													// only held for `update`'s own read-modify-write, not
													// across the git work above -- can make `oldName`
													// already gone from the fresh read. git has already been
													// fully renamed at this point, so silently returning
													// `fresh` unchanged would report success while
													// `.repos/config.json` stays stale and disagrees with
													// `.gitmodules`/the worktree. Fail typed instead:
													// `ReposConfigError` is already in `rename`'s declared
													// error channel and both the CLI and mcp adapters
													// `catchTag` it.
													yield* configStore.update(root, (fresh) => {
														const renamedEntry = getRepoEntry(fresh.repos, oldName);
														if (!renamedEntry) {
															return Effect.fail(
																new ReposConfigError({
																	path: MANIFEST_PATH,
																	reason: `rename applied to git but manifest entry "${oldName}" is gone; manifest and .gitmodules now disagree`,
																	kind: "invalid",
																}),
															);
														}
														const { [oldName]: _dropped, ...rest } = fresh.repos;
														return { repos: { ...rest, [newName]: renamedEntry } };
													});
													yield* git
														.add(root, [MANIFEST_PATH])
														.pipe(Effect.mapError(asSubmoduleError(`git add ${MANIFEST_PATH}`, root)));

													// 4. Verify: every git submodule status read must succeed
													// post-move -- the #363 failure mode was every git status
													// breaking after a hand `git mv`.
													yield* git
														.submoduleStatus(root)
														.pipe(Effect.mapError(asSubmoduleError("git submodule status", root)));
												}),
											),
										);

							const relockExit = yield* Effect.exit(lockdown.lock(root, lockName));
							if (Exit.isFailure(resultExit)) {
								return yield* Exit.failCause(resultExit.cause);
							}
							if (Exit.isFailure(relockExit)) {
								return yield* Exit.failCause(relockExit.cause);
							}
						}),
					);

					return {
						oldName,
						newName,
						path: newRepoPath,
						commitMessage: `chore(repos): rename ${oldName} to ${newName}`,
					};
				});

			const restore = (root: string, names?: ReadonlyArray<string>) =>
				Effect.gen(function* () {
					const manifest = yield* configStore.read(root);

					let targetNames: ReadonlyArray<string>;
					let skippedClean: ReadonlyArray<string> = [];

					if (names && names.length > 0) {
						// Explicit ask: validate every name exists BEFORE restoring any
						// of them -- a typo in a later name must not leave earlier ones
						// already reset. Explicit names are restored even when clean
						// (the caller asked for this one specifically); only the
						// names-omitted form below filters to dirty entries.
						for (const name of names) {
							if (!getRepoEntry(manifest.repos, name)) {
								return yield* Effect.fail(new RepoNotFoundError({ name }));
							}
						}
						targetNames = names;
					} else {
						const report = yield* status(root);
						targetNames = report.repos.filter((entry) => entry.dirty).map((entry) => entry.name);
						skippedClean = report.repos.filter((entry) => !entry.dirty).map((entry) => entry.name);
					}

					const restored: Array<{ name: string; commit: string }> = [];
					const stillDirty: string[] = [];

					for (const name of targetNames) {
						const entry = getRepoEntry(manifest.repos, name);
						if (!entry) {
							return yield* Effect.fail(new RepoNotFoundError({ name }));
						}

						const repoPath = `${REPOS_DIR}/${name}`;
						const subPath = path.join(root, repoPath);

						const commit = yield* lockdown.withUnlocked(
							root,
							name,
							Effect.gen(function* () {
								// The staged gitlink (index) takes priority over the
								// committed one -- a pin that was staged but never
								// committed must restore to what's staged, not silently
								// discard it back to the last commit (the
								// staged-gitlink-preference contract this op exists to
								// honor).
								const lsFiles = yield* git
									.lsFiles(root, { pathspec: [repoPath] })
									.pipe(Effect.mapError(asSubmoduleError(`git ls-files --stage -- ${repoPath}`, root)));
								const stagedCommit = lsFiles.find((lsFilesEntry) => lsFilesEntry.mode === "160000")?.oid;

								let targetCommit = stagedCommit;
								if (targetCommit === undefined) {
									const lsTree = yield* git
										.lsTree(root, "HEAD", { pathspec: [repoPath] })
										.pipe(Effect.mapError(asSubmoduleError(`git ls-tree HEAD -- ${repoPath}`, root)));
									targetCommit = lsTree[0]?.oid;
								}

								if (targetCommit === undefined) {
									return yield* Effect.fail(
										new GitSubmoduleError({
											command: "resolve restore target commit",
											cwd: subPath,
											reason: `no staged or committed gitlink commit found for "${name}" -- nothing to restore to`,
										}),
									);
								}

								// A vendored repo's OWN submodules must go first. `git reset
								// --hard` does not recurse, so a nested checkout that has
								// diverged from what this repo's pinned commit records
								// survives the reset untouched — the parent stays
								// permanently dirty (` M <nested>`) and the nested tree keeps
								// presenting source from a version this manifest does not
								// pin. Sparse-checkout cannot evict it either: sparse governs
								// the parent's TRACKED files, while an initialized
								// submodule's worktree belongs to its own repository.
								//
								// Deinitializing is the right repair rather than recursing
								// the reset: nothing in a vendored reference source is ever
								// meant to be materialized one level down, so the target
								// state is "no nested checkout at all", not "a nested
								// checkout at the recorded commit".
								//
								// `--all` on a repo with no submodules is a no-op, but the
								// status probe guards it anyway so a failure here is always
								// about a real nested tree. Both are tolerant: a vendored
								// repo whose nested state cannot be read is not a reason to
								// abandon the reset the caller actually asked for.
								const nested = yield* git.submoduleStatus(subPath).pipe(Effect.orElseSucceed(() => []));
								if (nested.some((nestedEntry) => nestedEntry.state !== "uninitialized")) {
									yield* git
										.submoduleDeinit(subPath, { all: true, force: true })
										.pipe(Effect.mapError(asSubmoduleError("git submodule deinit --all --force", subPath)));
								}

								yield* git
									.reset(subPath, { mode: "hard", ref: targetCommit })
									.pipe(Effect.mapError(asSubmoduleError(`git reset --hard ${targetCommit}`, subPath)));
								yield* git
									.clean(subPath, { directories: true })
									.pipe(Effect.mapError(asSubmoduleError("git clean --force -d", subPath)));

								if (entry.sparse && entry.sparse.length > 0) {
									yield* git
										.sparseCheckoutSet(subPath, entry.sparse, { cone: false })
										.pipe(Effect.mapError(asSubmoduleError("git sparse-checkout set --no-cone", subPath)));
								}

								// Verify rather than assume. Every step above can succeed
								// while leaving the tree dirty (the nested-submodule case
								// this method now repairs was exactly that shape, and an
								// unreadable nested state is tolerated above rather than
								// failed), so re-read the ground truth and let the caller
								// see it. Read INSIDE the unlock bracket: a `git status`
								// against a relocked tree is fine, but keeping it here means
								// it observes precisely the state the repair left behind.
								const afterStatus = yield* git
									.status(subPath)
									.pipe(Effect.mapError(asSubmoduleError("git status --porcelain", subPath)));

								return { targetCommit, dirty: afterStatus.length > 0 };
							}),
						);

						restored.push({ name, commit: commit.targetCommit });
						if (commit.dirty) {
							stillDirty.push(name);
						}
					}

					return { restored, skippedClean, stillDirty };
				});

			return {
				status,
				sync,
				add,
				pin,
				note,
				remove,
				rename,
				restore,
			};
		}),
	);
}
