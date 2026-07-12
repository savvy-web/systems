import { Command, CommandExecutor, FileSystem, Path } from "@effect/platform";
import { Context, Effect, Layer } from "effect";
import { REPOS_DIR } from "../constants.js";
import type { NoteNotFoundError, RepoNotFoundError, ReposConfigError } from "../errors.js";
import { GitSubmoduleError } from "../errors.js";
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
							yield* fs.remove(lockPath).pipe(Effect.orElseSucceed(() => undefined));
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

		return ReposManager.of({
			status,
			sync,
			add: (_root, _options) => Effect.die(new Error("not implemented")),
			pin: (_root, _name, _ref) => Effect.die(new Error("not implemented")),
			note: (_root, _name, _op) => Effect.die(new Error("not implemented")),
		});
	}),
);
