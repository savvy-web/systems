import { Command, CommandExecutor, FileSystem, Path } from "@effect/platform";
import { Context, Effect, Layer } from "effect";
import { MANIFEST_PATH, REPOS_DIR } from "../constants.js";
import type { NoteNotFoundError, ReposConfigError } from "../errors.js";
import { GitSubmoduleError, RepoNotFoundError } from "../errors.js";
import type { RepoEntry } from "../schemas/manifest.js";
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
 * The full contractual surface of {@link ReposManager}. `status` and `sync`
 * are implemented against real git plumbing; `add`, `pin`, and `note` are
 * declared here (with accurate error unions) and wired to `Effect.die` until
 * later tasks implement them.
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
 * manifest, and (in later tasks) adds/pins/annotates entries.
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

						const lsTree = yield* runGit(root, ["ls-tree", "HEAD", "--", `${REPOS_DIR}/${name}`]).pipe(
							Effect.orElseSucceed(() => ""),
						);
						const commit = lsTree.length > 0 ? (lsTree.split(/\s+/)[2] ?? null) : null;

						let dirty = false;
						if (present) {
							dirty = yield* runGit(repoPath, ["status", "--porcelain"]).pipe(
								Effect.map((out) => out.length > 0),
								Effect.orElseSucceed(() => false),
							);
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
						const lockExists = yield* fs.exists(lockPath).pipe(Effect.orElseSucceed(() => false));
						if (lockExists) {
							const removed = yield* fs
								.remove(lockPath)
								.pipe(Effect.match({ onSuccess: () => true, onFailure: () => false }));
							if (removed) {
								clearedAnyLock = true;
							}
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
				const repoPath = `${REPOS_DIR}/${name}`;
				const subPath = path.join(root, repoPath);

				yield* runGit(root, ["submodule", "add", "--depth", "1", options.url, repoPath]);
				yield* runGit(root, ["config", "-f", ".gitmodules", `submodule.${repoPath}.shallow`, "true"]);

				yield* fetchRef(subPath, options.ref);
				yield* runGit(subPath, ["checkout", "--detach", "FETCH_HEAD"]);

				if (options.sparse && options.sparse.length > 0) {
					yield* runGit(subPath, ["sparse-checkout", "set", "--no-cone", ...options.sparse]);
				}

				const exists = yield* configStore.exists(root);
				const manifest = exists ? yield* configStore.read(root) : { repos: {} };

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

		return ReposManager.of({
			status,
			sync,
			add,
			pin,
			note: (_root, _name, _op) => Effect.die(new Error("not implemented")),
		});
	}),
);
