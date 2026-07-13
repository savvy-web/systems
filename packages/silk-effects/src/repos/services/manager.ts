import { createHash } from "node:crypto";
import { Command, CommandExecutor, FileSystem, Path } from "@effect/platform";
import { Clock, Context, Effect, Layer, Option, Schema } from "effect";
import { MANIFEST_PATH, NOTE_LIMIT, REPOS_DIR } from "../constants.js";
import { GitSubmoduleError, NoteNotFoundError, RepoNotFoundError, ReposConfigError } from "../errors.js";
import type { RepoEntry, RepoNote, RepoOrientation, ReposManifestFile } from "../schemas/manifest.js";
import { RepoName } from "../schemas/manifest.js";
import type {
	ReposAddResult,
	ReposNoteResult,
	ReposPinResult,
	ReposStatusReport,
	ReposSyncReport,
} from "../schemas/reports.js";
import { ReposConfigStore } from "./config-store.js";

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
	readonly sync: (root: string) => Effect.Effect<ReposSyncReport, ReposConfigError | GitSubmoduleError>;
	readonly add: (
		root: string,
		options: {
			readonly url: string;
			readonly ref: string;
			readonly purpose: string;
			readonly name?: string;
			readonly sparse?: ReadonlyArray<string>;
		},
	) => Effect.Effect<ReposAddResult, ReposConfigError | GitSubmoduleError>;
	readonly pin: (
		root: string,
		name: string,
		ref: string,
	) => Effect.Effect<ReposPinResult, ReposConfigError | GitSubmoduleError | RepoNotFoundError>;
	readonly note: (
		root: string,
		name: string,
		op:
			| { readonly op: "add"; readonly note: string }
			| { readonly op: "remove"; readonly id: string }
			| { readonly op: "promote"; readonly id: string; readonly into: "layout" | "startHere" },
	) => Effect.Effect<ReposNoteResult, ReposConfigError | RepoNotFoundError | NoteNotFoundError>;
}

const _tag = Context.Tag("@savvy-web/silk-effects/ReposManager");
/** @internal */
export const ReposManagerBase = _tag<ReposManager, ReposManagerShape>();
/**
 * Drives the vendored `.repos/` submodules over git: reports status
 * (presence, dirtiness, stale notes), reconciles the working tree with the
 * manifest, vendors new entries (`add`), re-pins existing entries to a new
 * ref (`pin`), and adds, removes, or promotes agent notes (`note`).
 * @public
 */
export class ReposManager extends ReposManagerBase {}

/**
 * Live implementation of {@link ReposManager}.
 *
 * @remarks
 * Mirrors `TurboInspector`: the `CommandExecutor` is captured once at layer
 * construction and discharged onto each git invocation via
 * `Effect.provideService`, so the public method effects stay at `R = never`.
 * @public
 */
export const ReposManagerLive: Layer.Layer<
	ReposManager,
	never,
	ReposConfigStore | CommandExecutor.CommandExecutor | FileSystem.FileSystem | Path.Path
> = Layer.effect(
	ReposManager,
	Effect.gen(function* () {
		const configStore = yield* ReposConfigStore;
		const fs = yield* FileSystem.FileSystem;
		const path = yield* Path.Path;
		const executor = yield* CommandExecutor.CommandExecutor;

		const runGit = (cwd: string, args: ReadonlyArray<string>) =>
			Command.string(Command.workingDirectory(Command.make("git", ...args), cwd)).pipe(
				Effect.provideService(CommandExecutor.CommandExecutor, executor),
				Effect.mapError(
					(cause) => new GitSubmoduleError({ command: `git ${args.join(" ")}`, cwd, reason: String(cause) }),
				),
				Effect.map((s) => s.trim()),
			);

		const isPresent = (repoPath: string) =>
			fs.readDirectory(repoPath).pipe(
				Effect.map((files) => files.length > 0),
				Effect.orElseSucceed(() => false),
			);

		const status = (root: string) =>
			Effect.gen(function* () {
				const manifest = yield* configStore.read(root);
				const repos = yield* Effect.forEach(Object.entries(manifest.repos), ([name, entry]) =>
					Effect.gen(function* () {
						const repoPath = path.join(root, REPOS_DIR, name);
						const present = yield* isPresent(repoPath);

						// Empty stdout is a legitimate non-error: the path simply isn't
						// tracked at HEAD yet (e.g. `add` staged but not committed). A
						// failing `ls-tree` invocation itself (not present in this repo
						// at all, corrupt HEAD, etc.) is a real git failure and must
						// propagate as `GitSubmoduleError` rather than be read as "no
						// commit".
						const lsTree = yield* runGit(root, ["ls-tree", "HEAD", "--", `${REPOS_DIR}/${name}`]);
						const commit = lsTree.length > 0 ? (lsTree.split(/\s+/)[2] ?? null) : null;

						let dirty = false;
						if (present) {
							const porcelain = yield* runGit(repoPath, ["status", "--porcelain"]);
							dirty = porcelain.length > 0;
						}

						const staleNoteIds = (entry.notes ?? []).filter((note) => note.ref !== entry.ref).map((note) => note.id);

						return { name, ref: entry.ref, purpose: entry.purpose, present, commit, dirty, staleNoteIds };
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

				for (const [name, entry] of Object.entries(manifest.repos)) {
					const repoPath = path.join(root, REPOS_DIR, name);
					const moduleDir = path.join(root, ".git", "modules", REPOS_DIR, name);

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
					if (!present) {
						yield* runGit(root, ["submodule", "update", "--init", "--depth", "1", "--", `${REPOS_DIR}/${name}`]);
						initialized.push(name);
					} else {
						upToDate.push(name);
					}

					if (entry.sparse && entry.sparse.length > 0) {
						yield* runGit(repoPath, ["sparse-checkout", "set", "--no-cone", ...entry.sparse]);
						sparseApplied.push(name);
					}
				}

				return { initialized, sparseApplied, upToDate, clearedLocks };
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
		 * Fetch `ref` shallow into a submodule. Tags need the explicit
		 * `fetch origin tag <ref>` form; branches/commits fall back to a plain
		 * `fetch origin <ref>`.
		 */
		const fetchRef = (sub: string, ref: string) =>
			runGit(sub, ["fetch", "--depth", "1", "origin", "tag", ref]).pipe(
				Effect.orElse(() => runGit(sub, ["fetch", "--depth", "1", "origin", ref])),
			);

		const add = (
			root: string,
			options: {
				readonly url: string;
				readonly ref: string;
				readonly purpose: string;
				readonly name?: string;
				readonly sparse?: ReadonlyArray<string>;
			},
		) =>
			Effect.gen(function* () {
				const name = options.name ?? repoSlug(options.url);

				// 1. Validate the effective name BEFORE any side effect — a bad
				// name (path traversal, separators, "." or "..") must never reach
				// git or the filesystem.
				yield* Schema.decodeUnknown(RepoName)(name).pipe(
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
				if (manifest.repos[name]) {
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

				yield* runGit(root, ["submodule", "add", "--depth", "1", options.url, repoPath]);
				yield* runGit(root, ["config", "-f", ".gitmodules", `submodule.${repoPath}.shallow`, "true"]);

				yield* fetchRef(subPath, options.ref);
				yield* runGit(subPath, ["checkout", "--detach", "FETCH_HEAD"]);

				if (options.sparse && options.sparse.length > 0) {
					yield* runGit(subPath, ["sparse-checkout", "set", "--no-cone", ...options.sparse]);
				}

				const entry: RepoEntry = {
					url: options.url,
					ref: options.ref,
					purpose: options.purpose,
					...(options.sparse && options.sparse.length > 0 ? { sparse: options.sparse } : {}),
				};

				yield* configStore.write(root, { repos: { ...manifest.repos, [name]: entry } });

				yield* runGit(root, ["add", ".gitmodules", MANIFEST_PATH, repoPath]);

				return { name, ref: options.ref, path: repoPath };
			});

		const pin = (root: string, name: string, ref: string) =>
			Effect.gen(function* () {
				const manifest = yield* configStore.read(root);
				const entry = manifest.repos[name];
				if (!entry) {
					return yield* Effect.fail(new RepoNotFoundError({ name }));
				}

				const repoPath = `${REPOS_DIR}/${name}`;
				const subPath = path.join(root, repoPath);

				const oldCommit = yield* runGit(subPath, ["rev-parse", "HEAD"]).pipe(Effect.orElseSucceed(() => null));

				yield* fetchRef(subPath, ref);
				yield* runGit(subPath, ["checkout", "--detach", "FETCH_HEAD"]);
				const newCommit = yield* runGit(subPath, ["rev-parse", "HEAD"]);

				yield* configStore.write(root, {
					repos: { ...manifest.repos, [name]: { ...entry, ref } },
				});

				yield* runGit(root, ["add", MANIFEST_PATH, repoPath]);

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
				const entry = manifest.repos[name];
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
					yield* configStore.write(root, { repos: { ...manifest.repos, [name]: updatedEntry } });

					return { name, op: "add" as const, id, noteCount: updatedNotes.length };
				}

				const target = notes.find((existing) => existing.id === op.id);
				if (!target) {
					return yield* Effect.fail(new NoteNotFoundError({ name, id: op.id }));
				}
				const updatedNotes = notes.filter((existing) => existing.id !== op.id);

				if (op.op === "remove") {
					const updatedEntry: RepoEntry = { ...entry, notes: updatedNotes };
					yield* configStore.write(root, { repos: { ...manifest.repos, [name]: updatedEntry } });
					return { name, op: "remove" as const, id: op.id, noteCount: updatedNotes.length };
				}

				const updatedOrientation: RepoOrientation = { ...entry.orientation, [op.into]: target.note };
				const updatedEntry: RepoEntry = { ...entry, orientation: updatedOrientation, notes: updatedNotes };
				yield* configStore.write(root, { repos: { ...manifest.repos, [name]: updatedEntry } });
				return { name, op: "promote" as const, id: op.id, noteCount: updatedNotes.length };
			});

		return ReposManager.of({
			status,
			sync,
			add,
			pin,
			note,
		});
	}),
);
