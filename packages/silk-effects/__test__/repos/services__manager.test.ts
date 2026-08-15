import { execFileSync } from "node:child_process";
import {
	chmodSync,
	existsSync,
	mkdirSync,
	mkdtempSync,
	readFileSync,
	readdirSync,
	renameSync,
	rmSync,
	statSync,
	utimesSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import { NodeServices } from "@effect/platform-node";
import { afterAll, beforeAll, describe, expect, it } from "@effect/vitest";
import { Git, GitCommandError, LsRemoteEntry } from "@effected/git";
import { Cause, Effect, Layer, Option } from "effect";
import { REPOS_DIR } from "../../src/repos/constants.js";
import type { GitSubmoduleError } from "../../src/repos/errors.js";
import { ReposConfigError } from "../../src/repos/errors.js";
import type { ReposManifestFile } from "../../src/repos/schemas/manifest.js";
import type {
	ReposAddResult,
	ReposDeregisterResult,
	ReposNoteResult,
	ReposPinResult,
	ReposRemoveResult,
	ReposRenameResult,
	ReposRestoreResult,
	ReposStatusReport,
} from "../../src/repos/schemas/reports.js";
import { ReposConfigStore } from "../../src/repos/services/config-store.js";
import { ReposLockdown } from "../../src/repos/services/lockdown.js";
import { ReposManager, STALE_LOCK_MAX_AGE_MS } from "../../src/repos/services/manager.js";

const GIT_ENV = {
	GIT_AUTHOR_NAME: "Test",
	GIT_AUTHOR_EMAIL: "t@example.com",
	GIT_COMMITTER_NAME: "Test",
	GIT_COMMITTER_EMAIL: "t@example.com",
};

function git(cwd: string, ...args: string[]): string {
	return execFileSync("git", args, { cwd, encoding: "utf8", env: { ...process.env, ...GIT_ENV } });
}

/**
 * Suite timeout for the real-git suites below. These spawn `git init`,
 * `submodule add`, fetch and sparse-checkout against `file://` remotes; a
 * single test legitimately costs several seconds of wall clock, and under
 * full-suite parallelism they were landing just past Vitest's 5s default
 * (observed 5.0s-6.3s) and failing as timeouts while passing in isolation.
 * The budget is generous on purpose: it exists to absorb scheduling jitter,
 * not to mask a hang. The stubbed-executor suites keep the 5s default.
 */
const REAL_GIT_TIMEOUT = { timeout: 30_000 };

/**
 * `ReposManager.layer` now requires `ReposLockdown`; every composition in this
 * file threads this shared reference through so the layer construction
 * resolves. Production behavior of the tests written before Task 2 is
 * unaffected — they never observe `ReposLockdown` directly.
 */
const reposLockdownLayer = ReposLockdown.layer.pipe(Layer.provide(NodeServices.layer));

describe("ReposManager.status — stubbed executor", () => {
	it.effect("reports absent/clean/stale shape from a canned manifest with no filesystem or git backing", () =>
		Effect.gen(function* () {
			const manifest: ReposManifestFile = {
				repos: {
					spec: {
						url: "https://example.com/spec.git",
						ref: "1.0.0",
						purpose: "spec authority",
						notes: [
							{ id: "stale-note", date: "2026-01-01", ref: "0.9.0", note: "written against an older pin" },
							{ id: "fresh-note", date: "2026-01-01", ref: "1.0.0", note: "written against the current pin" },
						],
					},
				},
			};

			const configStoreStub = Layer.succeed(ReposConfigStore, {
				exists: () => Effect.succeed(true),
				read: () => Effect.succeed(manifest),
				write: () => Effect.succeed(undefined),
			} as never);

			// A Git stub whose ls-tree/ls-files list nothing — the path isn't
			// tracked at HEAD or staged in the index, and the repo dir is absent
			// so `status`/`revParse` are never consulted.
			const gitStub = Layer.succeed(Git, {
				lsTree: () => Effect.succeed([]),
				lsFiles: () => Effect.succeed([]),
				status: () => Effect.succeed([]),
			} as never);

			const root = mkdtempSync(join(tmpdir(), "repos-manager-status-"));

			const report: ReposStatusReport = yield* Effect.gen(function* () {
				const manager = yield* ReposManager;
				return yield* manager.status(root);
			}).pipe(
				Effect.provide(ReposManager.layer),
				Effect.provide(configStoreStub),
				Effect.provide(gitStub),
				Effect.provide(reposLockdownLayer),
				Effect.provide(NodeServices.layer),
			) as Effect.Effect<ReposStatusReport>;

			expect(report.repos).toHaveLength(1);
			const entry = report.repos[0];
			expect(entry?.name).toBe("spec");
			expect(entry?.present).toBe(false);
			expect(entry?.stagedCommit).toBeUndefined();
			expect(entry?.committedCommit).toBeUndefined();
			expect(entry?.checkedOutCommit).toBeUndefined();
			expect(entry?.dirty).toBe(false);
			expect(entry?.staleNoteIds).toEqual(["stale-note"]);
			expect(report.clean).toBe(false);
		}),
	);
});

describe("ReposManager.sync / status — real git", REAL_GIT_TIMEOUT, () => {
	function makeUpstream(): string {
		const up = mkdtempSync(join(tmpdir(), "repos-manager-upstream-"));
		git(up, "init", "--quiet", "-b", "main");
		git(up, "config", "commit.gpgsign", "false");
		mkdirSync(join(up, "src"), { recursive: true });
		mkdirSync(join(up, "docs"), { recursive: true });
		writeFileSync(join(up, "src", "keep.ts"), "export const keep = true;\n");
		writeFileSync(join(up, "docs", "skip.md"), "# skip\n");
		git(up, "add", "-A");
		git(up, "commit", "--quiet", "-m", "initial");
		git(up, "tag", "1.0.0");
		return up;
	}

	function makeHost(): string {
		const host = mkdtempSync(join(tmpdir(), "repos-manager-host-"));
		git(host, "init", "--quiet", "-b", "main");
		// file:// submodule URLs need this in the HOST test repo right after init.
		// Test-only: production code must never carry this flag.
		execFileSync("git", ["config", "protocol.file.allow", "always"], { cwd: host });
		git(host, "config", "commit.gpgsign", "false");
		writeFileSync(join(host, "README.md"), "# host\n");
		git(host, "add", "-A");
		git(host, "commit", "--quiet", "-m", "initial");
		return host;
	}

	/** Simulate a prior `repos add`: register the submodule, pin it to `ref`, commit it, then blow away the worktree. */
	function simulatePriorAdd(host: string, upstreamUrl: string, name: string, ref: string): void {
		execFileSync("git", ["submodule", "add", upstreamUrl, `.repos/${name}`], {
			cwd: host,
			env: { ...process.env, ...GIT_ENV, GIT_ALLOW_PROTOCOL: "file" },
		});
		git(join(host, ".repos", name), "checkout", ref);
		git(host, "add", ".repos", ".gitmodules");
		git(host, "commit", "--quiet", "-m", `add ${name} submodule`);
		rmSync(join(host, ".repos", name), { recursive: true, force: true });
	}

	it.effect(
		"re-materializes a missing submodule, applies sparse-checkout, then reports up-to-date and clean on a second sync",
		() =>
			Effect.gen(function* () {
				const up = makeUpstream();
				const host = makeHost();
				const name = "spec";
				const upstreamUrl = `file://${up}`;

				mkdirSync(join(host, ".repos"), { recursive: true });
				writeFileSync(
					join(host, ".repos", "config.json"),
					JSON.stringify({
						repos: { [name]: { url: upstreamUrl, ref: "1.0.0", purpose: "spec authority", sparse: ["src"] } },
					}),
				);

				simulatePriorAdd(host, upstreamUrl, name, "1.0.0");

				const configStoreReal = Layer.succeed(ReposConfigStore, {
					exists: () => Effect.succeed(true),
					read: () =>
						Effect.succeed({
							repos: { [name]: { url: upstreamUrl, ref: "1.0.0", purpose: "spec authority", sparse: ["src"] } },
						} as ReposManifestFile),
					write: () => Effect.succeed(undefined),
				} as never);

				const managerLayer = ReposManager.layer.pipe(
					Layer.provide(configStoreReal),
					Layer.provide(Git.layer.pipe(Layer.provide(NodeServices.layer))),
					Layer.provide(reposLockdownLayer),
					Layer.provide(NodeServices.layer),
				);
				const run = <A, E>(effect: Effect.Effect<A, E, ReposManager>) =>
					effect.pipe(Effect.provide(managerLayer)) as Effect.Effect<A, E>;

				const firstSync = yield* run(
					Effect.gen(function* () {
						const manager = yield* ReposManager;
						return yield* manager.sync(host);
					}),
				);

				expect(firstSync.initialized).toEqual([name]);
				expect(firstSync.sparseApplied).toEqual([name]);
				expect(firstSync.upToDate).toEqual([]);

				expect(readdirSync(join(host, ".repos", name, "src"))).toContain("keep.ts");
				expect(() => readdirSync(join(host, ".repos", name, "docs"))).toThrow();

				const secondSync = yield* run(
					Effect.gen(function* () {
						const manager = yield* ReposManager;
						return yield* manager.sync(host);
					}),
				);
				expect(secondSync.upToDate).toEqual([name]);
				expect(secondSync.initialized).toEqual([]);

				const statusClean = yield* run(
					Effect.gen(function* () {
						const manager = yield* ReposManager;
						return yield* manager.status(host);
					}),
				);
				const cleanEntry = statusClean.repos.find((r) => r.name === name);
				expect(cleanEntry?.present).toBe(true);
				expect(cleanEntry?.dirty).toBe(false);
				expect(cleanEntry?.stagedCommit).toBeDefined();
				expect(cleanEntry?.committedCommit).toBe(cleanEntry?.stagedCommit);
				expect(cleanEntry?.checkedOutCommit).toBe(cleanEntry?.stagedCommit);

				// `sync` leaves the tree locked (Task 2): simulate an external edit by
				// unlocking the one file this test needs to dirty, the way a human
				// bypassing the lockdown boundary would have to.
				chmodSync(join(host, ".repos", name, "src", "keep.ts"), 0o644);
				writeFileSync(join(host, ".repos", name, "src", "keep.ts"), "export const keep = false;\n");

				const statusDirty = yield* run(
					Effect.gen(function* () {
						const manager = yield* ReposManager;
						return yield* manager.status(host);
					}),
				);
				const dirtyEntry = statusDirty.repos.find((r) => r.name === name);
				expect(dirtyEntry?.present).toBe(true);
				expect(dirtyEntry?.dirty).toBe(true);
			}),
	);

	// `it.live`, NOT `it.effect`: the subject reads Effect's Clock (manager.ts:183) to compute
	// `now - mtime` against STALE_LOCK_MAX_AGE_MS, while the fixture backdates the lock's mtime
	// with the real wall clock. Under `it.effect`'s virtual clock `now` is the epoch, so the age
	// comes out around -1.79e12, every lock reads as young, and this test fails loudly.
	it.live("clears stale lock files during sync and reports them in clearedLocks", () =>
		Effect.gen(function* () {
			const up = makeUpstream();
			const host = makeHost();
			const name = "spec";
			const upstreamUrl = `file://${up}`;

			mkdirSync(join(host, ".repos"), { recursive: true });
			writeFileSync(
				join(host, ".repos", "config.json"),
				JSON.stringify({
					repos: { [name]: { url: upstreamUrl, ref: "1.0.0", purpose: "spec authority" } },
				}),
			);

			simulatePriorAdd(host, upstreamUrl, name, "1.0.0");

			// Create stale lock files before syncing, then backdate their mtime past
			// the staleness threshold so `sync` treats them as abandoned rather than
			// held by an active git process.
			const lockDirPath = join(host, ".git", "modules", ".repos", name);
			mkdirSync(lockDirPath, { recursive: true });
			writeFileSync(join(lockDirPath, "index.lock"), "");
			writeFileSync(join(lockDirPath, "shallow.lock"), "");
			const staleTime = new Date(Date.now() - STALE_LOCK_MAX_AGE_MS - 60_000);
			utimesSync(join(lockDirPath, "index.lock"), staleTime, staleTime);
			utimesSync(join(lockDirPath, "shallow.lock"), staleTime, staleTime);

			const configStoreReal = Layer.succeed(ReposConfigStore, {
				exists: () => Effect.succeed(true),
				read: () =>
					Effect.succeed({
						repos: { [name]: { url: upstreamUrl, ref: "1.0.0", purpose: "spec authority" } },
					} as ReposManifestFile),
				write: () => Effect.succeed(undefined),
			} as never);

			const managerLayer = ReposManager.layer.pipe(
				Layer.provide(configStoreReal),
				Layer.provide(Git.layer.pipe(Layer.provide(NodeServices.layer))),
				Layer.provide(reposLockdownLayer),
				Layer.provide(NodeServices.layer),
			);
			const run = <A, E>(effect: Effect.Effect<A, E, ReposManager>) =>
				effect.pipe(Effect.provide(managerLayer)) as Effect.Effect<A, E>;

			const syncResult = yield* run(
				Effect.gen(function* () {
					const manager = yield* ReposManager;
					return yield* manager.sync(host);
				}),
			);

			// Verify lock files were cleared
			expect(syncResult.clearedLocks).toContain(name);
			expect(existsSync(join(lockDirPath, "index.lock"))).toBe(false);
			expect(existsSync(join(lockDirPath, "shallow.lock"))).toBe(false);
		}),
	);

	// `it.live`, NOT `it.effect` — and this is the DANGEROUS one. Same epoch arithmetic as the
	// stale-lock test above, but here the expected outcome is "the lock survives", which is also
	// what the epoch bug produces. Under `it.effect` this test would stay green while never once
	// exercising the age guard it exists to protect. It must run on the real clock to mean anything.
	it.live("leaves a young lock file in place and omits the repo from clearedLocks", () =>
		Effect.gen(function* () {
			const up = makeUpstream();
			const host = makeHost();
			const name = "spec";
			const upstreamUrl = `file://${up}`;

			mkdirSync(join(host, ".repos"), { recursive: true });
			writeFileSync(
				join(host, ".repos", "config.json"),
				JSON.stringify({
					repos: { [name]: { url: upstreamUrl, ref: "1.0.0", purpose: "spec authority" } },
				}),
			);

			simulatePriorAdd(host, upstreamUrl, name, "1.0.0");

			// A freshly-written lock file — well within the staleness window — as if
			// an active git process currently holds it.
			const lockDirPath = join(host, ".git", "modules", ".repos", name);
			mkdirSync(lockDirPath, { recursive: true });
			writeFileSync(join(lockDirPath, "index.lock"), "");

			const configStoreReal = Layer.succeed(ReposConfigStore, {
				exists: () => Effect.succeed(true),
				read: () =>
					Effect.succeed({
						repos: { [name]: { url: upstreamUrl, ref: "1.0.0", purpose: "spec authority" } },
					} as ReposManifestFile),
				write: () => Effect.succeed(undefined),
			} as never);

			const managerLayer = ReposManager.layer.pipe(
				Layer.provide(configStoreReal),
				Layer.provide(Git.layer.pipe(Layer.provide(NodeServices.layer))),
				Layer.provide(reposLockdownLayer),
				Layer.provide(NodeServices.layer),
			);
			const run = <A, E>(effect: Effect.Effect<A, E, ReposManager>) =>
				Effect.exit(effect.pipe(Effect.provide(managerLayer)) as Effect.Effect<A, E>);

			const exit = yield* run(
				Effect.gen(function* () {
					const manager = yield* ReposManager;
					return yield* manager.sync(host);
				}),
			);

			// The young lock survives regardless of whether the subsequent git
			// operation itself succeeded or failed on the contested lock.
			expect(existsSync(join(lockDirPath, "index.lock"))).toBe(true);
			if (exit._tag === "Success") {
				expect(exit.value.clearedLocks).not.toContain(name);
			}
		}),
	);

	// Reproduces the re-slugged-after-vendoring split: the submodule is
	// registered under a git module name that diverges from the manifest key
	// (`--name`), and the worktree checkout is left IN PLACE (unlike
	// `simulatePriorAdd`, which blows it away) so `.repos/<name>/.git` still
	// carries a live `gitdir:` pointer at the divergently-named module dir.
	// Stale-lock clearing must follow that pointer rather than assume
	// `.git/modules/.repos/<name>`.
	it.live("clears stale lock files under a divergently-named module dir", () =>
		Effect.gen(function* () {
			const up = makeUpstream();
			const host = makeHost();
			const name = "spec";
			const moduleName = "spec-old";
			const upstreamUrl = `file://${up}`;

			mkdirSync(join(host, ".repos"), { recursive: true });
			writeFileSync(
				join(host, ".repos", "config.json"),
				JSON.stringify({
					repos: { [name]: { url: upstreamUrl, ref: "1.0.0", purpose: "spec authority" } },
				}),
			);

			execFileSync("git", ["submodule", "add", "--name", moduleName, upstreamUrl, `.repos/${name}`], {
				cwd: host,
				env: { ...process.env, ...GIT_ENV, GIT_ALLOW_PROTOCOL: "file" },
			});
			git(join(host, ".repos", name), "checkout", "1.0.0");
			git(host, "add", ".repos", ".gitmodules");
			git(host, "commit", "--quiet", "-m", `add ${name} submodule`);
			// deliberately no rmSync here — the worktree (and its .git gitdir
			// pointer file) stays in place, unlike simulatePriorAdd.

			const lockDirPath = join(host, ".git", "modules", moduleName);
			mkdirSync(lockDirPath, { recursive: true });
			writeFileSync(join(lockDirPath, "index.lock"), "");
			writeFileSync(join(lockDirPath, "shallow.lock"), "");
			const staleTime = new Date(Date.now() - STALE_LOCK_MAX_AGE_MS - 60_000);
			utimesSync(join(lockDirPath, "index.lock"), staleTime, staleTime);
			utimesSync(join(lockDirPath, "shallow.lock"), staleTime, staleTime);

			const configStoreReal = Layer.succeed(ReposConfigStore, {
				exists: () => Effect.succeed(true),
				read: () =>
					Effect.succeed({
						repos: { [name]: { url: upstreamUrl, ref: "1.0.0", purpose: "spec authority" } },
					} as ReposManifestFile),
				write: () => Effect.succeed(undefined),
			} as never);

			const managerLayer = ReposManager.layer.pipe(
				Layer.provide(configStoreReal),
				Layer.provide(Git.layer.pipe(Layer.provide(NodeServices.layer))),
				Layer.provide(reposLockdownLayer),
				Layer.provide(NodeServices.layer),
			);
			const run = <A, E>(effect: Effect.Effect<A, E, ReposManager>) =>
				effect.pipe(Effect.provide(managerLayer)) as Effect.Effect<A, E>;

			const syncResult = yield* run(
				Effect.gen(function* () {
					const manager = yield* ReposManager;
					return yield* manager.sync(host);
				}),
			);

			expect(syncResult.clearedLocks).toContain(name);
			expect(existsSync(join(lockDirPath, "index.lock"))).toBe(false);
			expect(existsSync(join(lockDirPath, "shallow.lock"))).toBe(false);
		}),
	);

	it.effect("reconciles a drifted submodule URL: writes .gitmodules, syncs git config, reports urlSynced", () =>
		Effect.gen(function* () {
			const up = makeUpstream();
			const up2 = makeUpstream();
			const host = makeHost();
			const name = "spec";
			const upstreamUrl = `file://${up}`;
			const newUpstreamUrl = `file://${up2}`;

			mkdirSync(join(host, ".repos"), { recursive: true });
			writeFileSync(
				join(host, ".repos", "config.json"),
				JSON.stringify({
					repos: { [name]: { url: newUpstreamUrl, ref: "1.0.0", purpose: "spec authority" } },
				}),
			);

			// Register the submodule against the OLD url first, so the manifest
			// (edited to the new url above) and the submodule's live config
			// diverge -- exactly the drift `sync` must reconcile.
			simulatePriorAdd(host, upstreamUrl, name, "1.0.0");

			const configStoreReal = Layer.succeed(ReposConfigStore, {
				exists: () => Effect.succeed(true),
				read: () =>
					Effect.succeed({
						repos: { [name]: { url: newUpstreamUrl, ref: "1.0.0", purpose: "spec authority" } },
					} as ReposManifestFile),
				write: () => Effect.succeed(undefined),
			} as never);

			const managerLayer = ReposManager.layer.pipe(
				Layer.provide(configStoreReal),
				Layer.provide(Git.layer.pipe(Layer.provide(NodeServices.layer))),
				Layer.provide(reposLockdownLayer),
				Layer.provide(NodeServices.layer),
			);
			const run = <A, E>(effect: Effect.Effect<A, E, ReposManager>) =>
				effect.pipe(Effect.provide(managerLayer)) as Effect.Effect<A, E>;

			// The prior `simulatePriorAdd` blows the worktree away; re-materialize
			// it first so the url-drift branch (present + gitmodules section) is
			// the one exercised, not the missing-worktree branch.
			yield* run(
				Effect.gen(function* () {
					const manager = yield* ReposManager;
					return yield* manager.sync(host);
				}),
			);

			const syncResult = yield* run(
				Effect.gen(function* () {
					const manager = yield* ReposManager;
					return yield* manager.sync(host);
				}),
			);

			expect(syncResult.urlSynced).toEqual([name]);
			expect(syncResult.upToDate).toEqual([]);

			const gitmodules = readFileSync(join(host, ".gitmodules"), "utf8");
			expect(gitmodules).toContain(newUpstreamUrl);

			const remoteV = git(join(host, ".repos", name), "remote", "-v");
			expect(remoteV).toContain(newUpstreamUrl);
		}),
	);

	it.effect("registers an orphan manifest entry (no worktree, no .gitmodules section) and reports registered", () =>
		Effect.gen(function* () {
			const previousAllowProtocol = process.env.GIT_ALLOW_PROTOCOL;
			process.env.GIT_ALLOW_PROTOCOL = "file";
			try {
				const up = makeUpstream();
				const host = makeHost();
				const name = "spec";
				const upstreamUrl = `file://${up}`;

				mkdirSync(join(host, ".repos"), { recursive: true });
				writeFileSync(
					join(host, ".repos", "config.json"),
					JSON.stringify({
						repos: { [name]: { url: upstreamUrl, ref: "1.0.0", purpose: "spec authority" } },
					}),
				);
				// Deliberately no `simulatePriorAdd` -- this manifest entry has
				// never been registered with git at all: no worktree, no
				// `.gitmodules` section.

				const configStoreReal = Layer.succeed(ReposConfigStore, {
					exists: () => Effect.succeed(true),
					read: () =>
						Effect.succeed({
							repos: { [name]: { url: upstreamUrl, ref: "1.0.0", purpose: "spec authority" } },
						} as ReposManifestFile),
					write: () => Effect.succeed(undefined),
				} as never);

				const managerLayer = ReposManager.layer.pipe(
					Layer.provide(configStoreReal),
					Layer.provide(Git.layer.pipe(Layer.provide(NodeServices.layer))),
					Layer.provide(reposLockdownLayer),
					Layer.provide(NodeServices.layer),
				);
				const run = <A, E>(effect: Effect.Effect<A, E, ReposManager>) =>
					effect.pipe(Effect.provide(managerLayer)) as Effect.Effect<A, E>;

				const syncResult = yield* run(
					Effect.gen(function* () {
						const manager = yield* ReposManager;
						return yield* manager.sync(host);
					}),
				);

				expect(syncResult.registered).toEqual([name]);
				expect(syncResult.initialized).toEqual([]);
				expect(readdirSync(join(host, ".repos", name, "src"))).toContain("keep.ts");

				const headRef = git(join(host, ".repos", name), "rev-parse", "HEAD").trim();
				const tagRef = git(up, "rev-parse", "1.0.0").trim();
				expect(headRef).toBe(tagRef);
			} finally {
				if (previousAllowProtocol === undefined) {
					delete process.env.GIT_ALLOW_PROTOCOL;
				} else {
					process.env.GIT_ALLOW_PROTOCOL = previousAllowProtocol;
				}
			}
		}),
	);

	it.effect("leaves an unchanged entry reporting upToDate, with no urlSynced/registered", () =>
		Effect.gen(function* () {
			const up = makeUpstream();
			const host = makeHost();
			const name = "spec";
			const upstreamUrl = `file://${up}`;

			mkdirSync(join(host, ".repos"), { recursive: true });
			writeFileSync(
				join(host, ".repos", "config.json"),
				JSON.stringify({
					repos: { [name]: { url: upstreamUrl, ref: "1.0.0", purpose: "spec authority" } },
				}),
			);
			simulatePriorAdd(host, upstreamUrl, name, "1.0.0");

			const configStoreReal = Layer.succeed(ReposConfigStore, {
				exists: () => Effect.succeed(true),
				read: () =>
					Effect.succeed({
						repos: { [name]: { url: upstreamUrl, ref: "1.0.0", purpose: "spec authority" } },
					} as ReposManifestFile),
				write: () => Effect.succeed(undefined),
			} as never);

			const managerLayer = ReposManager.layer.pipe(
				Layer.provide(configStoreReal),
				Layer.provide(Git.layer.pipe(Layer.provide(NodeServices.layer))),
				Layer.provide(reposLockdownLayer),
				Layer.provide(NodeServices.layer),
			);
			const run = <A, E>(effect: Effect.Effect<A, E, ReposManager>) =>
				effect.pipe(Effect.provide(managerLayer)) as Effect.Effect<A, E>;

			// First sync re-materializes the worktree (simulatePriorAdd blew it
			// away); the second sync is the one under test -- nothing drifted.
			yield* run(
				Effect.gen(function* () {
					const manager = yield* ReposManager;
					return yield* manager.sync(host);
				}),
			);

			const syncResult = yield* run(
				Effect.gen(function* () {
					const manager = yield* ReposManager;
					return yield* manager.sync(host);
				}),
			);

			expect(syncResult.upToDate).toEqual([name]);
			expect(syncResult.urlSynced).toEqual([]);
			expect(syncResult.registered).toEqual([]);
			expect(syncResult.initialized).toEqual([]);
		}),
	);

	it.effect(
		"initializes a missing worktree under a pre-declared update=none marker, which stays none across the sync",
		() =>
			Effect.gen(function* () {
				const up = makeUpstream();
				const host = makeHost();
				const name = "spec";
				const upstreamUrl = `file://${up}`;

				mkdirSync(join(host, ".repos"), { recursive: true });
				writeFileSync(
					join(host, ".repos", "config.json"),
					JSON.stringify({
						repos: { [name]: { url: upstreamUrl, ref: "1.0.0", purpose: "spec authority" } },
					}),
				);
				simulatePriorAdd(host, upstreamUrl, name, "1.0.0");

				// The state a previously synced checkout is in: the vendored
				// boundary already declared (`update = none`) while the worktree
				// has gone missing. Without `--checkout` on the initialize call,
				// `git submodule update --init` honors the marker and SKIPS the
				// submodule — reporting success while checking out nothing — so
				// the worktree assertion below is the discriminating one.
				git(host, "config", `submodule..repos/${name}.update`, "none");

				const configStoreReal = Layer.succeed(ReposConfigStore, {
					exists: () => Effect.succeed(true),
					read: () =>
						Effect.succeed({
							repos: { [name]: { url: upstreamUrl, ref: "1.0.0", purpose: "spec authority" } },
						} as ReposManifestFile),
					write: () => Effect.succeed(undefined),
				} as never);

				const managerLayer = ReposManager.layer.pipe(
					Layer.provide(configStoreReal),
					Layer.provide(Git.layer.pipe(Layer.provide(NodeServices.layer))),
					Layer.provide(reposLockdownLayer),
					Layer.provide(NodeServices.layer),
				);

				const run = <A, E>(effect: Effect.Effect<A, E, ReposManager>) =>
					effect.pipe(Effect.provide(managerLayer)) as Effect.Effect<A, E>;

				const syncResult = yield* run(
					Effect.gen(function* () {
						const manager = yield* ReposManager;
						return yield* manager.sync(host);
					}),
				);

				expect(syncResult.initialized).toEqual([name]);
				// The worktree really materialized — the silent-skip false success
				// `--checkout` exists to prevent.
				expect(readdirSync(join(host, ".repos", name, "src"))).toContain("keep.ts");
				// And the boundary marker was never flipped: it reads `none` after
				// the sync, with no `checkout` window ever written around the
				// initialize call.
				expect(git(host, "config", "--get", `submodule..repos/${name}.update`).trim()).toBe("none");
			}),
	);

	it.effect(
		"fails typed with GitSubmoduleError, rather than reporting an absent checkedOutCommit, when the checkout's HEAD is corrupted",
		() =>
			Effect.gen(function* () {
				const up = makeUpstream();
				const host = makeHost();
				const name = "spec";
				const upstreamUrl = `file://${up}`;

				// A present worktree registered and committed like `simulatePriorAdd`,
				// but WITHOUT the trailing `rmSync` -- this test needs the worktree
				// to stay present so `status` actually reaches `revParse`.
				execFileSync("git", ["submodule", "add", upstreamUrl, `.repos/${name}`], {
					cwd: host,
					env: { ...process.env, ...GIT_ENV, GIT_ALLOW_PROTOCOL: "file" },
				});
				git(join(host, ".repos", name), "checkout", "1.0.0");
				git(host, "add", ".repos", ".gitmodules");
				git(host, "commit", "--quiet", "-m", `add ${name} submodule`);

				mkdirSync(join(host, ".repos"), { recursive: true });
				writeFileSync(
					join(host, ".repos", "config.json"),
					JSON.stringify({
						repos: { [name]: { url: upstreamUrl, ref: "1.0.0", purpose: "spec authority" } },
					}),
				);

				// Corrupt the submodule's own `HEAD` (in its real gitdir under
				// `.git/modules`, not the worktree's `.git` gitlink FILE) so it
				// symbolically references a branch that does not exist. Git's
				// stderr for this ("fatal: Needed a single revision") does NOT match
				// the `NOT_A_REPOSITORY` pattern the kit folds to absence, unlike a
				// broken gitdir POINTER (which git itself reports as "not a git
				// repository" and is therefore, correctly, folded to absence as a
				// genuine no-checkout case) -- this is the discriminating corruption
				// for the "propagate everything else" half of the fix.
				const gitdirHead = join(host, ".git", "modules", ".repos", name, "HEAD");
				writeFileSync(gitdirHead, "ref: refs/heads/does-not-exist\n");

				const configStoreReal = Layer.succeed(ReposConfigStore, {
					exists: () => Effect.succeed(true),
					read: () =>
						Effect.succeed({
							repos: { [name]: { url: upstreamUrl, ref: "1.0.0", purpose: "spec authority" } },
						} as ReposManifestFile),
					write: () => Effect.succeed(undefined),
				} as never);

				const managerLayer = ReposManager.layer.pipe(
					Layer.provide(configStoreReal),
					Layer.provide(Git.layer.pipe(Layer.provide(NodeServices.layer))),
					Layer.provide(reposLockdownLayer),
					Layer.provide(NodeServices.layer),
				);

				const error = yield* Effect.gen(function* () {
					const manager = yield* ReposManager;
					return yield* manager.status(host);
				}).pipe(Effect.provide(managerLayer), Effect.flip);

				expect(error).toMatchObject({ _tag: "GitSubmoduleError" });
			}),
	);
});

describe("ReposManager.add / pin — real git", REAL_GIT_TIMEOUT, () => {
	// `git submodule add` does NOT honor repo-local `protocol.file.allow` config
	// (unlike `submodule update --init`), so the production `add`/`pin` paths need
	// this scoped globally for the child git processes they spawn. Test-only: the
	// production code itself must never carry any file-protocol allowance.
	let previousAllowProtocol: string | undefined;

	beforeAll(() => {
		previousAllowProtocol = process.env.GIT_ALLOW_PROTOCOL;
		process.env.GIT_ALLOW_PROTOCOL = "file";
	});

	afterAll(() => {
		if (previousAllowProtocol === undefined) {
			delete process.env.GIT_ALLOW_PROTOCOL;
		} else {
			process.env.GIT_ALLOW_PROTOCOL = previousAllowProtocol;
		}
	});

	function makeUpstream(): string {
		const up = mkdtempSync(join(tmpdir(), "repos-manager-add-upstream-"));
		git(up, "init", "--quiet", "-b", "main");
		git(up, "config", "commit.gpgsign", "false");
		mkdirSync(join(up, "src"), { recursive: true });
		mkdirSync(join(up, "docs"), { recursive: true });
		writeFileSync(join(up, "src", "keep.ts"), "export const keep = true;\n");
		writeFileSync(join(up, "docs", "skip.md"), "# skip\n");
		git(up, "add", "-A");
		git(up, "commit", "--quiet", "-m", "initial");
		git(up, "tag", "1.0.0");
		return up;
	}

	function makeHost(): string {
		const host = mkdtempSync(join(tmpdir(), "repos-manager-add-host-"));
		git(host, "init", "--quiet", "-b", "main");
		execFileSync("git", ["config", "protocol.file.allow", "always"], { cwd: host });
		git(host, "config", "commit.gpgsign", "false");
		writeFileSync(join(host, "README.md"), "# host\n");
		git(host, "add", "-A");
		git(host, "commit", "--quiet", "-m", "initial");
		return host;
	}

	it.effect(
		"stages a new submodule + manifest entry on add, then re-pins it to a new tag without committing either time",
		() =>
			Effect.gen(function* () {
				const up = makeUpstream();
				const host = makeHost();
				const name = "spec";
				const upstreamUrl = `file://${up}`;

				const configStoreLayer = ReposConfigStore.layer.pipe(Layer.provide(NodeServices.layer));
				const managerLayer = ReposManager.layer.pipe(
					Layer.provide(configStoreLayer),
					Layer.provide(Git.layer.pipe(Layer.provide(NodeServices.layer))),
					Layer.provide(reposLockdownLayer),
					Layer.provide(NodeServices.layer),
				);
				const run = <A, E>(effect: Effect.Effect<A, E, ReposManager>) =>
					effect.pipe(Effect.provide(managerLayer)) as Effect.Effect<A, E>;

				const commitCountBefore = git(host, "log", "--oneline").trim().split("\n").length;

				const addResult: ReposAddResult = yield* run(
					Effect.gen(function* () {
						const manager = yield* ReposManager;
						return yield* manager.add(host, {
							url: upstreamUrl,
							ref: "1.0.0",
							purpose: "spec authority",
							name,
							sparse: ["src"],
							// Passing orientation through `add` is what makes a
							// remove-then-re-add remedy lossless; without it the block an
							// agent relies on to navigate a vendored tree is destroyed
							// silently by the standard repair.
							orientation: { layout: "src/ holds the spec", startHere: "src/keep.ts" },
						});
					}),
				);

				expect(addResult).toEqual({ name, ref: "1.0.0", path: `.repos/${name}` });

				// Submodule materialized and sparse-checkout applied.
				expect(existsSync(join(host, ".repos", name))).toBe(true);
				expect(readdirSync(join(host, ".repos", name, "src"))).toContain("keep.ts");
				expect(() => readdirSync(join(host, ".repos", name, "docs"))).toThrow();

				// .gitmodules carries the shallow flag.
				const gitmodules = readFileSync(join(host, ".gitmodules"), "utf8");
				expect(gitmodules).toContain("shallow = true");

				// The vendored boundary is declared at creation, not deferred to the
				// next `sync`: an undeclared window is one in which every git client
				// is free to manage the tree. `active` must stay true — an inactive
				// submodule reads as uninitialized in `git submodule status`, which
				// would make every drift report claim a missing worktree.
				expect(git(host, "config", "--get", `submodule..repos/${name}.update`).trim()).toBe("none");
				expect(git(host, "config", "--get", "fetch.recurseSubmodules").trim()).toBe("false");
				expect(git(host, "config", "--get", `submodule..repos/${name}.active`).trim()).toBe("true");

				// Manifest entry was written.
				const manifestPath = join(host, ".repos", "config.json");
				const manifestAfterAdd = JSON.parse(readFileSync(manifestPath, "utf8")) as ReposManifestFile;
				expect(manifestAfterAdd.repos[name]).toMatchObject({
					url: upstreamUrl,
					ref: "1.0.0",
					purpose: "spec authority",
					sparse: ["src"],
					orientation: { layout: "src/ holds the spec", startHere: "src/keep.ts" },
				});

				// Staged, not committed.
				const stagedAfterAdd = git(host, "diff", "--cached", "--name-only").trim().split("\n");
				expect(stagedAfterAdd).toEqual(expect.arrayContaining([".gitmodules", ".repos/config.json", `.repos/${name}`]));
				expect(git(host, "log", "--oneline").trim().split("\n").length).toBe(commitCountBefore);

				// Pre-seed a note against the current ref, as `note` (Task 5) would have.
				const addedEntry = manifestAfterAdd.repos[name];
				if (!addedEntry) {
					throw new Error("expected manifest entry to exist after add");
				}
				const manifestWithNote: ReposManifestFile = {
					repos: {
						...manifestAfterAdd.repos,
						[name]: {
							...addedEntry,
							notes: [{ id: "note-1", date: "2026-07-12", ref: "1.0.0", note: "written against 1.0.0" }],
						},
					},
				};
				writeFileSync(manifestPath, `${JSON.stringify(manifestWithNote, null, "\t")}\n`);

				// Cut a second tag upstream.
				writeFileSync(join(up, "src", "keep.ts"), "export const keep = false;\n");
				git(up, "add", "-A");
				git(up, "commit", "--quiet", "-m", "second");
				git(up, "tag", "2.0.0");
				const expectedCommit = git(up, "rev-parse", "2.0.0").trim();

				const pinResult: ReposPinResult = yield* run(
					Effect.gen(function* () {
						const manager = yield* ReposManager;
						return yield* manager.pin(host, name, "2.0.0");
					}),
				);

				expect(pinResult.name).toBe(name);
				expect(pinResult.ref).toBe("2.0.0");
				expect(pinResult.newCommit).toBe(expectedCommit);
				expect(pinResult.commitMessage).toBe(`chore(repos): pin ${name} to 2.0.0`);
				expect(pinResult.staleNoteIds).toEqual(["note-1"]);

				const manifestAfterPin = JSON.parse(readFileSync(manifestPath, "utf8")) as ReposManifestFile;
				expect(manifestAfterPin.repos[name]?.ref).toBe("2.0.0");

				const stagedAfterPin = git(host, "diff", "--cached", "--name-only").trim().split("\n");
				expect(stagedAfterPin).toEqual(expect.arrayContaining([".repos/config.json", `.repos/${name}`]));
				expect(git(host, "log", "--oneline").trim().split("\n").length).toBe(commitCountBefore);
			}),
	);

	it.effect(
		"reports the pin→commit window triple: staged diverges from committed while the pin is uncommitted, then converges once committed",
		() =>
			Effect.gen(function* () {
				const up = makeUpstream();
				const host = makeHost();
				const name = "spec";
				const upstreamUrl = `file://${up}`;

				const configStoreLayer = ReposConfigStore.layer.pipe(Layer.provide(NodeServices.layer));
				const managerLayer = ReposManager.layer.pipe(
					Layer.provide(configStoreLayer),
					Layer.provide(Git.layer.pipe(Layer.provide(NodeServices.layer))),
					Layer.provide(reposLockdownLayer),
					Layer.provide(NodeServices.layer),
				);
				const run = <A, E>(effect: Effect.Effect<A, E, ReposManager>) =>
					effect.pipe(Effect.provide(managerLayer)) as Effect.Effect<A, E>;

				yield* run(
					Effect.gen(function* () {
						const manager = yield* ReposManager;
						return yield* manager.add(host, { url: upstreamUrl, ref: "1.0.0", purpose: "spec authority", name });
					}),
				);
				// Commit the staged add so there is a stable committed baseline to
				// diverge from -- the window this test targets only exists once
				// `stagedCommit`/`committedCommit` can disagree.
				git(host, "commit", "--quiet", "-m", "add spec submodule");
				const oldCommit = git(join(host, ".repos", name), "rev-parse", "HEAD").trim();

				writeFileSync(join(up, "src", "keep.ts"), "export const keep = false;\n");
				git(up, "add", "-A");
				git(up, "commit", "--quiet", "-m", "second");
				git(up, "tag", "2.0.0");
				const newCommit = git(up, "rev-parse", "2.0.0").trim();

				yield* run(
					Effect.gen(function* () {
						const manager = yield* ReposManager;
						return yield* manager.pin(host, name, "2.0.0");
					}),
				);

				const statusPinned = yield* run(
					Effect.gen(function* () {
						const manager = yield* ReposManager;
						return yield* manager.status(host);
					}),
				);
				const pinnedEntry = statusPinned.repos.find((r) => r.name === name);
				expect(pinnedEntry?.stagedCommit).toBe(newCommit);
				expect(pinnedEntry?.committedCommit).toBe(oldCommit);
				expect(pinnedEntry?.checkedOutCommit).toBe(newCommit);

				git(host, "commit", "--quiet", "-m", "pin spec to 2.0.0");

				const statusConverged = yield* run(
					Effect.gen(function* () {
						const manager = yield* ReposManager;
						return yield* manager.status(host);
					}),
				);
				const convergedEntry = statusConverged.repos.find((r) => r.name === name);
				expect(convergedEntry?.stagedCommit).toBe(newCommit);
				expect(convergedEntry?.committedCommit).toBe(newCommit);
				expect(convergedEntry?.checkedOutCommit).toBe(newCommit);
			}),
	);

	it.effect("fails with RepoNotFoundError when pinning a name absent from the manifest", () =>
		Effect.gen(function* () {
			const configStoreStub = Layer.succeed(ReposConfigStore, {
				exists: () => Effect.succeed(true),
				read: () => Effect.succeed({ repos: {} } as ReposManifestFile),
				write: () => Effect.succeed(undefined),
			} as never);

			const root = mkdtempSync(join(tmpdir(), "repos-manager-pin-missing-"));

			// `pin` fails at the manifest lookup before any git call, so an empty
			// Git stub satisfies `ReposManager.layer`'s requirement without spawning.
			const gitStub = Layer.succeed(Git, {} as never);

			const pinExit = yield* Effect.exit(
				Effect.gen(function* () {
					const manager = yield* ReposManager;
					return yield* manager.pin(root, "does-not-exist", "1.0.0");
				}).pipe(
					Effect.provide(ReposManager.layer),
					Effect.provide(configStoreStub),
					Effect.provide(gitStub),
					Effect.provide(reposLockdownLayer),
					Effect.provide(NodeServices.layer),
				) as Effect.Effect<unknown, unknown>,
			);

			expect(pinExit._tag).toBe("Failure");
			if (pinExit._tag === "Failure") {
				expect(Option.getOrThrow(Cause.findErrorOption(pinExit.cause))).toMatchObject({
					_tag: "RepoNotFoundError",
					name: "does-not-exist",
				});
			}
		}),
	);

	it.effect("derives the default name slug from the upstream URL, stripping .git suffix", () =>
		Effect.gen(function* () {
			const up = makeUpstream();
			const host = makeHost();
			const upstreamBareDir = mkdtempSync(join(tmpdir(), "repos-manager-slug-upstream-"));
			execFileSync("git", ["clone", "--bare", up, join(upstreamBareDir, "myrepo.git")], {
				cwd: upstreamBareDir,
				env: { ...process.env, ...GIT_ENV },
			});
			const upstreamUrl = `file://${join(upstreamBareDir, "myrepo.git")}`;

			const configStoreLayer = ReposConfigStore.layer.pipe(Layer.provide(NodeServices.layer));
			const managerLayer = ReposManager.layer.pipe(
				Layer.provide(configStoreLayer),
				Layer.provide(Git.layer.pipe(Layer.provide(NodeServices.layer))),
				Layer.provide(reposLockdownLayer),
				Layer.provide(NodeServices.layer),
			);
			const run = <A, E>(effect: Effect.Effect<A, E, ReposManager>) =>
				effect.pipe(Effect.provide(managerLayer)) as Effect.Effect<A, E>;

			const addResult: ReposAddResult = yield* run(
				Effect.gen(function* () {
					const manager = yield* ReposManager;
					return yield* manager.add(host, {
						url: upstreamUrl,
						ref: "1.0.0",
						purpose: "spec authority",
						// no name provided — should derive from URL
					});
				}),
			);

			expect(addResult.name).toBe("myrepo"); // .git stripped
			expect(addResult.path).toBe(".repos/myrepo");

			const manifestPath = join(host, ".repos", "config.json");
			const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as ReposManifestFile;
			expect(Object.keys(manifest.repos)).toContain("myrepo");
			expect(manifest.repos.myrepo?.url).toBe(upstreamUrl);
		}),
	);

	it.effect("pins to a branch ref via fallback fetch when tag form fails", () =>
		Effect.gen(function* () {
			const up = makeUpstream();
			const host = makeHost();
			const name = "spec";
			const upstreamUrl = `file://${up}`;

			// Create a branch at a commit DISTINCT from tag 1.0.0. Under the old
			// exit-code-blind runner the failed tag fetch left FETCH_HEAD at the
			// add's 1.0.0 commit and the fallback never fired — a branch pointing
			// at 1.0.0 made this test pass coincidentally. A distinct commit
			// proves the plain-fetch fallback actually ran.
			writeFileSync(join(up, "src", "branch-only.ts"), "export const branchOnly = true;\n");
			git(up, "add", "-A");
			git(up, "commit", "--quiet", "-m", "branch-only commit");
			git(up, "branch", "stable");
			git(up, "reset", "--hard", "--quiet", "1.0.0");
			const stableSha = git(up, "rev-parse", "stable").trim();
			expect(stableSha).not.toBe(git(up, "rev-parse", "1.0.0^{commit}").trim());

			const configStoreLayer = ReposConfigStore.layer.pipe(Layer.provide(NodeServices.layer));
			const managerLayer = ReposManager.layer.pipe(
				Layer.provide(configStoreLayer),
				Layer.provide(Git.layer.pipe(Layer.provide(NodeServices.layer))),
				Layer.provide(reposLockdownLayer),
				Layer.provide(NodeServices.layer),
			);
			const run = <A, E>(effect: Effect.Effect<A, E, ReposManager>) =>
				effect.pipe(Effect.provide(managerLayer)) as Effect.Effect<A, E>;

			// First add the repo with tag ref
			yield* run(
				Effect.gen(function* () {
					const manager = yield* ReposManager;
					return yield* manager.add(host, {
						url: upstreamUrl,
						ref: "1.0.0",
						purpose: "spec authority",
						name,
					});
				}),
			);

			// Now pin to branch ref (tag fetch will fail, should fallback to plain fetch)
			const pinResult: ReposPinResult = yield* run(
				Effect.gen(function* () {
					const manager = yield* ReposManager;
					return yield* manager.pin(host, name, "stable");
				}),
			);

			expect(pinResult.newCommit).toBe(stableSha);
			expect(pinResult.ref).toBe("stable");

			const manifestPath = join(host, ".repos", "config.json");
			const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as ReposManifestFile;
			expect(manifest.repos[name]?.ref).toBe("stable");
		}),
	);

	it.effect("preserves untouched entries when pinning one of many repos in the manifest", () =>
		Effect.gen(function* () {
			const up1 = makeUpstream();
			const up2 = mkdtempSync(join(tmpdir(), "repos-manager-add-upstream-"));
			git(up2, "init", "--quiet", "-b", "main");
			git(up2, "config", "commit.gpgsign", "false");
			mkdirSync(join(up2, "src"), { recursive: true });
			writeFileSync(join(up2, "src", "other.ts"), "export const other = true;\n");
			git(up2, "add", "-A");
			git(up2, "commit", "--quiet", "-m", "initial");
			git(up2, "tag", "1.0.0");

			const host = makeHost();

			const configStoreLayer = ReposConfigStore.layer.pipe(Layer.provide(NodeServices.layer));
			const managerLayer = ReposManager.layer.pipe(
				Layer.provide(configStoreLayer),
				Layer.provide(Git.layer.pipe(Layer.provide(NodeServices.layer))),
				Layer.provide(reposLockdownLayer),
				Layer.provide(NodeServices.layer),
			);
			const run = <A, E>(effect: Effect.Effect<A, E, ReposManager>) =>
				effect.pipe(Effect.provide(managerLayer)) as Effect.Effect<A, E>;

			const upstreamUrl1 = `file://${up1}`;
			const upstreamUrl2 = `file://${up2}`;

			// Add two repos
			yield* run(
				Effect.gen(function* () {
					const manager = yield* ReposManager;
					return yield* manager.add(host, {
						url: upstreamUrl1,
						ref: "1.0.0",
						purpose: "spec authority",
						name: "spec",
					});
				}),
			);

			yield* run(
				Effect.gen(function* () {
					const manager = yield* ReposManager;
					return yield* manager.add(host, {
						url: upstreamUrl2,
						ref: "1.0.0",
						purpose: "other repo",
						name: "other",
					});
				}),
			);

			const manifestPath = join(host, ".repos", "config.json");
			const manifestBefore = JSON.parse(readFileSync(manifestPath, "utf8")) as ReposManifestFile;
			const otherEntryBefore = manifestBefore.repos.other;
			expect(otherEntryBefore).toBeDefined();
			if (!otherEntryBefore) {
				throw new Error("expected manifest entry to exist before pin");
			}

			// Add a note to the "other" repo to make sure it survives the pin
			const manifestWithNote: ReposManifestFile = {
				repos: {
					...manifestBefore.repos,
					other: {
						...otherEntryBefore,
						notes: [{ id: "note-1", date: "2026-07-12", ref: "1.0.0", note: "a note" }],
					},
				},
			};
			writeFileSync(manifestPath, `${JSON.stringify(manifestWithNote, null, "\t")}\n`);

			// Pin the first repo to a new tag (create it first)
			writeFileSync(join(up1, "src", "keep.ts"), "export const keep = false;\n");
			git(up1, "add", "-A");
			git(up1, "commit", "--quiet", "-m", "second");
			git(up1, "tag", "2.0.0");

			yield* run(
				Effect.gen(function* () {
					const manager = yield* ReposManager;
					return yield* manager.pin(host, "spec", "2.0.0");
				}),
			);

			// Read and verify both entries still exist
			const manifestAfter = JSON.parse(readFileSync(manifestPath, "utf8")) as ReposManifestFile;

			// spec should be updated
			expect(manifestAfter.repos.spec?.ref).toBe("2.0.0");

			// other should be completely untouched (including the note)
			expect(manifestAfter.repos.other).toEqual(manifestWithNote.repos.other);
		}),
	);

	it.effect("surfaces a nonexistent-ref pin as GitSubmoduleError carrying git's stderr, not silence", () =>
		Effect.gen(function* () {
			const up = makeUpstream();
			const host = makeHost();
			const name = "spec";
			const upstreamUrl = `file://${up}`;

			const configStoreLayer = ReposConfigStore.layer.pipe(Layer.provide(NodeServices.layer));
			const managerLayer = ReposManager.layer.pipe(
				Layer.provide(configStoreLayer),
				Layer.provide(Git.layer.pipe(Layer.provide(NodeServices.layer))),
				Layer.provide(reposLockdownLayer),
				Layer.provide(NodeServices.layer),
			);
			const run = <A, E>(effect: Effect.Effect<A, E, ReposManager>) =>
				effect.pipe(Effect.provide(managerLayer)) as Effect.Effect<A, E>;
			const runExit = <A, E>(effect: Effect.Effect<A, E, ReposManager>) =>
				Effect.exit(effect.pipe(Effect.provide(managerLayer)) as Effect.Effect<A, E>);

			yield* run(
				Effect.gen(function* () {
					const manager = yield* ReposManager;
					return yield* manager.add(host, { url: upstreamUrl, ref: "1.0.0", purpose: "spec authority", name });
				}),
			);

			const exit = yield* runExit(
				Effect.gen(function* () {
					const manager = yield* ReposManager;
					return yield* manager.pin(host, name, "no-such-ref-xyz");
				}),
			);

			expect(exit._tag).toBe("Failure");
			if (exit._tag === "Failure") {
				expect(Option.getOrThrow(Cause.findErrorOption(exit.cause))).toMatchObject({ _tag: "GitSubmoduleError" });
				// The reason carries git's stderr naming the missing ref — before the
				// exit-code-aware runner, this pin "succeeded" silently.
				expect((Option.getOrThrow(Cause.findErrorOption(exit.cause)) as { reason: string }).reason).toContain(
					"no-such-ref-xyz",
				);
			}
		}),
	);

	// #377: pin's own git operations never touch `.gitmodules` (only `sync`,
	// Task 3, reconciles URLs into it) — but a caller may have hand-applied an
	// out-of-band edit to it (e.g. a URL fix) that is still sitting unstaged
	// when `pin` runs. `pin` must pick that up and stage it alongside the ref
	// bump it already stages, rather than leave it stranded.
	it.effect("stages .gitmodules alongside the ref bump when it is already modified in the working tree", () =>
		Effect.gen(function* () {
			const up = makeUpstream();
			const host = makeHost();
			const name = "spec";
			const upstreamUrl = `file://${up}`;

			const configStoreLayer = ReposConfigStore.layer.pipe(Layer.provide(NodeServices.layer));
			const managerLayer = ReposManager.layer.pipe(
				Layer.provide(configStoreLayer),
				Layer.provide(Git.layer.pipe(Layer.provide(NodeServices.layer))),
				Layer.provide(reposLockdownLayer),
				Layer.provide(NodeServices.layer),
			);
			const run = <A, E>(effect: Effect.Effect<A, E, ReposManager>) =>
				effect.pipe(Effect.provide(managerLayer)) as Effect.Effect<A, E>;

			yield* run(
				Effect.gen(function* () {
					const manager = yield* ReposManager;
					return yield* manager.add(host, { url: upstreamUrl, ref: "1.0.0", purpose: "spec authority", name });
				}),
			);

			// Commit the `add` so this test starts from a clean baseline, the way
			// a real workflow would between `add` and a later `pin`.
			git(host, "commit", "--quiet", "-m", "vendor spec");

			// Simulate an out-of-band edit to `.gitmodules` (e.g. a hand-applied
			// URL fix that differs from what the manifest already carries) —
			// left uncommitted, exactly as a caller would leave it.
			const gitmodulesPath = join(host, ".gitmodules");
			writeFileSync(gitmodulesPath, `${readFileSync(gitmodulesPath, "utf8")}\tignore = untracked\n`);

			writeFileSync(join(up, "src", "keep.ts"), "export const keep = false;\n");
			git(up, "add", "-A");
			git(up, "commit", "--quiet", "-m", "second");
			git(up, "tag", "2.0.0");

			yield* run(
				Effect.gen(function* () {
					const manager = yield* ReposManager;
					return yield* manager.pin(host, name, "2.0.0");
				}),
			);

			const staged = git(host, "diff", "--cached", "--name-only").trim().split("\n");
			expect(staged).toContain(".gitmodules");
		}),
	);

	it.effect("leaves .gitmodules unstaged on pin when it is not modified in the working tree", () =>
		Effect.gen(function* () {
			const up = makeUpstream();
			const host = makeHost();
			const name = "spec";
			const upstreamUrl = `file://${up}`;

			const configStoreLayer = ReposConfigStore.layer.pipe(Layer.provide(NodeServices.layer));
			const managerLayer = ReposManager.layer.pipe(
				Layer.provide(configStoreLayer),
				Layer.provide(Git.layer.pipe(Layer.provide(NodeServices.layer))),
				Layer.provide(reposLockdownLayer),
				Layer.provide(NodeServices.layer),
			);
			const run = <A, E>(effect: Effect.Effect<A, E, ReposManager>) =>
				effect.pipe(Effect.provide(managerLayer)) as Effect.Effect<A, E>;

			yield* run(
				Effect.gen(function* () {
					const manager = yield* ReposManager;
					return yield* manager.add(host, { url: upstreamUrl, ref: "1.0.0", purpose: "spec authority", name });
				}),
			);

			git(host, "commit", "--quiet", "-m", "vendor spec");

			writeFileSync(join(up, "src", "keep.ts"), "export const keep = false;\n");
			git(up, "add", "-A");
			git(up, "commit", "--quiet", "-m", "second");
			git(up, "tag", "2.0.0");

			yield* run(
				Effect.gen(function* () {
					const manager = yield* ReposManager;
					return yield* manager.pin(host, name, "2.0.0");
				}),
			);

			const staged = git(host, "diff", "--cached", "--name-only").trim().split("\n");
			expect(staged).not.toContain(".gitmodules");
			expect(staged).toEqual(expect.arrayContaining([".repos/config.json", `.repos/${name}`]));
		}),
	);

	it.effect("rejects an invalid --name before any side effect (path traversal)", () =>
		Effect.gen(function* () {
			const up = makeUpstream();
			const host = makeHost();
			const upstreamUrl = `file://${up}`;

			const configStoreLayer = ReposConfigStore.layer.pipe(Layer.provide(NodeServices.layer));
			const managerLayer = ReposManager.layer.pipe(
				Layer.provide(configStoreLayer),
				Layer.provide(Git.layer.pipe(Layer.provide(NodeServices.layer))),
				Layer.provide(reposLockdownLayer),
				Layer.provide(NodeServices.layer),
			);
			const runExit = <A, E>(effect: Effect.Effect<A, E, ReposManager>) =>
				Effect.exit(effect.pipe(Effect.provide(managerLayer)) as Effect.Effect<A, E>);

			const exit = yield* runExit(
				Effect.gen(function* () {
					const manager = yield* ReposManager;
					return yield* manager.add(host, {
						url: upstreamUrl,
						ref: "1.0.0",
						purpose: "spec authority",
						name: "../evil",
					});
				}),
			);

			expect(exit._tag).toBe("Failure");
			if (exit._tag === "Failure") {
				expect(Option.getOrThrow(Cause.findErrorOption(exit.cause))).toMatchObject({
					_tag: "ReposConfigError",
					kind: "invalid",
				});
				expect((Option.getOrThrow(Cause.findErrorOption(exit.cause)) as { reason: string }).reason).toContain(
					"../evil",
				);
			}

			// No side effects: no manifest ever created, and no git changes staged
			// or committed (the submodule add never ran).
			expect(existsSync(join(host, ".repos"))).toBe(false);
			expect(existsSync(join(host, "..", "evil"))).toBe(false);
			expect(git(host, "status", "--porcelain").trim()).toBe("");
		}),
	);

	it.effect("fails cleanly on a duplicate name: manifest byte-identical, no git error state", () =>
		Effect.gen(function* () {
			const up = makeUpstream();
			const host = makeHost();
			const name = "spec";
			const upstreamUrl = `file://${up}`;

			const configStoreLayer = ReposConfigStore.layer.pipe(Layer.provide(NodeServices.layer));
			const managerLayer = ReposManager.layer.pipe(
				Layer.provide(configStoreLayer),
				Layer.provide(Git.layer.pipe(Layer.provide(NodeServices.layer))),
				Layer.provide(reposLockdownLayer),
				Layer.provide(NodeServices.layer),
			);
			const run = <A, E>(effect: Effect.Effect<A, E, ReposManager>) =>
				effect.pipe(Effect.provide(managerLayer)) as Effect.Effect<A, E>;
			const runExit = <A, E>(effect: Effect.Effect<A, E, ReposManager>) =>
				Effect.exit(effect.pipe(Effect.provide(managerLayer)) as Effect.Effect<A, E>);

			yield* run(
				Effect.gen(function* () {
					const manager = yield* ReposManager;
					return yield* manager.add(host, { url: upstreamUrl, ref: "1.0.0", purpose: "spec authority", name });
				}),
			);

			const manifestPath = join(host, ".repos", "config.json");
			const manifestBefore = readFileSync(manifestPath, "utf8");

			const exit = yield* runExit(
				Effect.gen(function* () {
					const manager = yield* ReposManager;
					return yield* manager.add(host, { url: upstreamUrl, ref: "1.0.0", purpose: "duplicate attempt", name });
				}),
			);

			expect(exit._tag).toBe("Failure");
			if (exit._tag === "Failure") {
				expect(Option.getOrThrow(Cause.findErrorOption(exit.cause))).toMatchObject({
					_tag: "ReposConfigError",
					kind: "invalid",
				});
				expect((Option.getOrThrow(Cause.findErrorOption(exit.cause)) as { reason: string }).reason).toContain(
					"already vendored",
				);
			}

			const manifestAfter = readFileSync(manifestPath, "utf8");
			expect(manifestAfter).toBe(manifestBefore);
		}),
	);

	it.effect(
		"fails with a typed ref-not-found error before any side effect, suggesting a monorepo-prefixed near miss",
		() =>
			Effect.gen(function* () {
				const up = mkdtempSync(join(tmpdir(), "repos-manager-add-badref-upstream-"));
				git(up, "init", "--quiet", "-b", "main");
				git(up, "config", "commit.gpgsign", "false");
				writeFileSync(join(up, "README.md"), "# up\n");
				git(up, "add", "-A");
				git(up, "commit", "--quiet", "-m", "initial");
				// The upstream only advertises a monorepo-prefixed tag -- requesting
				// the bare version must fail typed, suggesting this near miss.
				git(up, "tag", "pkg@1.0.0");

				const host = makeHost();
				const name = "spec";
				const upstreamUrl = `file://${up}`;

				const configStoreLayer = ReposConfigStore.layer.pipe(Layer.provide(NodeServices.layer));
				const managerLayer = ReposManager.layer.pipe(
					Layer.provide(configStoreLayer),
					Layer.provide(Git.layer.pipe(Layer.provide(NodeServices.layer))),
					Layer.provide(reposLockdownLayer),
					Layer.provide(NodeServices.layer),
				);
				const runExit = <A, E>(effect: Effect.Effect<A, E, ReposManager>) =>
					Effect.exit(effect.pipe(Effect.provide(managerLayer)) as Effect.Effect<A, E>);

				const exit = yield* runExit(
					Effect.gen(function* () {
						const manager = yield* ReposManager;
						return yield* manager.add(host, { url: upstreamUrl, ref: "1.0.0", purpose: "spec authority", name });
					}),
				);

				expect(exit._tag).toBe("Failure");
				if (exit._tag === "Failure") {
					const failure = Option.getOrThrow(Cause.findErrorOption(exit.cause));
					expect(failure).toMatchObject({ _tag: "GitSubmoduleError" });
					expect((failure as { reason: string }).reason).toContain("pkg@1.0.0");
				}

				// No side effect at all: no gitlink in the index, no `.gitmodules`
				// section, no worktree -- the failure happened before any mutation.
				expect(existsSync(join(host, ".gitmodules"))).toBe(false);
				expect(existsSync(join(host, ".repos", name))).toBe(false);
				expect(git(host, "status", "--porcelain").trim()).toBe("");
			}),
	);

	it.effect(
		"resumes a same-url partial add (gitlink staged, .gitmodules registered, no manifest) instead of re-running submodule add",
		() =>
			Effect.gen(function* () {
				const up = makeUpstream();
				const host = makeHost();
				const name = "spec";
				const upstreamUrl = `file://${up}`;

				// Reproduce the exact partial state a prior `add` leaves behind when
				// it dies right after `git submodule add` (the gitlink staged,
				// `.gitmodules` registered) but before fetch/checkout -- no manifest
				// entry was ever written. Re-running `git submodule add` on top of
				// this WITHOUT the resumable skip fails ("already exists in the
				// index"), so this test is a genuine proof the skip fired.
				execFileSync("git", ["submodule", "add", "--depth", "1", upstreamUrl, `.repos/${name}`], {
					cwd: host,
					env: { ...process.env, ...GIT_ENV, GIT_ALLOW_PROTOCOL: "file" },
				});

				const configStoreLayer = ReposConfigStore.layer.pipe(Layer.provide(NodeServices.layer));
				const managerLayer = ReposManager.layer.pipe(
					Layer.provide(configStoreLayer),
					Layer.provide(Git.layer.pipe(Layer.provide(NodeServices.layer))),
					Layer.provide(reposLockdownLayer),
					Layer.provide(NodeServices.layer),
				);
				const run = <A, E>(effect: Effect.Effect<A, E, ReposManager>) =>
					effect.pipe(Effect.provide(managerLayer)) as Effect.Effect<A, E>;

				const addResult: ReposAddResult = yield* run(
					Effect.gen(function* () {
						const manager = yield* ReposManager;
						return yield* manager.add(host, { url: upstreamUrl, ref: "1.0.0", purpose: "spec authority", name });
					}),
				);

				expect(addResult).toEqual({ name, ref: "1.0.0", path: `.repos/${name}` });

				const manifestPath = join(host, ".repos", "config.json");
				const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as ReposManifestFile;
				expect(manifest.repos[name]).toMatchObject({ url: upstreamUrl, ref: "1.0.0" });

				// Checked out at the pinned ref, and the tree is locked again after
				// `withUnlocked` completes.
				expect(git(join(host, ".repos", name), "rev-parse", "HEAD").trim()).toBe(git(up, "rev-parse", "1.0.0").trim());
				const modeAfter = statSync(join(host, ".repos", name)).mode & 0o777;
				expect(modeAfter).toBe(0o555);
			}),
	);

	it.effect(
		"rolls back a late failure (gitlink, worktree, module gitdir, .gitmodules section) and propagates the original error",
		() =>
			Effect.gen(function* () {
				// Stub-level test (per the plan's C2 addendum): the failure is
				// injected deterministically at the fetch step, well after `git
				// submodule add` would have succeeded, which real git cannot be
				// coerced into failing at reliably. `ReposLockdown`/`FileSystem` stay
				// real so the rollback's filesystem cleanup is genuinely verified.
				const root = mkdtempSync(join(tmpdir(), "repos-manager-add-rollback-"));
				const name = "spec";
				const upstreamUrl = "file:///fake/upstream";
				const repoDir = join(root, ".repos", name);
				const moduleDir = join(root, ".git", "modules", ".repos", name);
				const gitmodulesPath = join(root, ".gitmodules");

				// Simulate what a (stubbed, no-op) `git submodule add` plus
				// `git config` would have produced on disk: a worktree directory, a
				// module gitdir, and a `.gitmodules` section for this submodule.
				mkdirSync(repoDir, { recursive: true });
				writeFileSync(join(repoDir, "marker.txt"), "worktree\n");
				mkdirSync(moduleDir, { recursive: true });
				writeFileSync(join(moduleDir, "marker.txt"), "gitdir\n");
				// `git submodule add` names the section after the PATH, not the
				// bare manifest key -- this fixture mirrors the real shape so the
				// rollback's `.gitmodules` cleanup is actually exercised against
				// the section it will find in production, not a bare-name section
				// that would never occur outside a test.
				writeFileSync(
					gitmodulesPath,
					`[submodule ".repos/${name}"]\n\tpath = .repos/${name}\n\turl = ${upstreamUrl}\n`,
				);

				let deinitCalled = false;
				let rmCalled = false;

				const fetchFailure = GitCommandError.make({
					kind: "failed",
					args: ["fetch", "--depth", "1", "origin", "1.0.0"],
					cwd: repoDir,
					stderr: "unable to access upstream",
				});

				const gitStub = Git.layerTest({
					lsRemote: () => Effect.succeed([LsRemoteEntry.make({ sha: "0".repeat(40), ref: "refs/tags/1.0.0" })]),
					lsFiles: () => Effect.succeed([]),
					submoduleAdd: () => Effect.succeed(undefined),
					configSet: () => Effect.succeed(undefined),
					fetchAny: () => Effect.fail(fetchFailure),
					submoduleDeinit: () => {
						deinitCalled = true;
						return Effect.succeed(undefined);
					},
					rm: () => {
						rmCalled = true;
						return Effect.succeed(undefined);
					},
				});

				const configStoreLayer = ReposConfigStore.layer.pipe(Layer.provide(NodeServices.layer));
				const managerLayer = ReposManager.layer.pipe(
					Layer.provide(configStoreLayer),
					Layer.provide(gitStub),
					Layer.provide(reposLockdownLayer),
					Layer.provide(NodeServices.layer),
				);
				const runExit = <A, E>(effect: Effect.Effect<A, E, ReposManager>) =>
					Effect.exit(effect.pipe(Effect.provide(managerLayer)) as Effect.Effect<A, E>);

				const exit = yield* runExit(
					Effect.gen(function* () {
						const manager = yield* ReposManager;
						return yield* manager.add(root, { url: upstreamUrl, ref: "1.0.0", purpose: "spec authority", name });
					}),
				);

				expect(exit._tag).toBe("Failure");
				if (exit._tag === "Failure") {
					const failure = Option.getOrThrow(Cause.findErrorOption(exit.cause));
					expect(failure).toMatchObject({ _tag: "GitSubmoduleError" });
					expect((failure as { reason: string }).reason).toContain("unable to access upstream");
				}

				expect(deinitCalled).toBe(true);
				expect(rmCalled).toBe(true);
				expect(existsSync(repoDir)).toBe(false);
				expect(existsSync(moduleDir)).toBe(false);
				const gitmodulesAfter = existsSync(gitmodulesPath) ? readFileSync(gitmodulesPath, "utf8") : "";
				expect(gitmodulesAfter).not.toContain(`submodule ".repos/${name}"`);
				expect(existsSync(join(root, ".repos", "config.json"))).toBe(false);
			}),
	);

	it.effect(
		"rolls back using the .git pointer's REAL module dir, not the name-based fallback, when registered under a divergent name",
		() =>
			Effect.gen(function* () {
				// Regression for reading the `.git` pointer file AFTER
				// `submoduleDeinit` has already cleared the worktree (pointer
				// included): the resolver must run BEFORE deinit or it silently
				// degrades to the name-based fallback and orphans the real module
				// gitdir whenever the submodule was registered under a name other
				// than the manifest key (the divergently-named case `resolveModuleDir`
				// exists to handle).
				const root = mkdtempSync(join(tmpdir(), "repos-manager-add-rollback-divergent-"));
				const name = "spec";
				const upstreamUrl = "file:///fake/upstream";
				const repoDir = join(root, ".repos", name);
				// The REAL module gitdir the worktree's `.git` pointer names.
				const moduleDirActual = join(root, ".git", "modules", ".repos", "other-name");
				// The name-based fallback `resolveModuleDir` degrades to whenever the
				// pointer can't be read -- deliberately never created here, so the
				// bug's signature is "this now exists" or "moduleDirActual survives".
				const moduleDirFallback = join(root, ".git", "modules", ".repos", name);
				const gitmodulesPath = join(root, ".gitmodules");

				mkdirSync(repoDir, { recursive: true });
				writeFileSync(join(repoDir, "marker.txt"), "worktree\n");
				mkdirSync(moduleDirActual, { recursive: true });
				writeFileSync(join(moduleDirActual, "marker.txt"), "gitdir\n");
				writeFileSync(join(repoDir, ".git"), `gitdir: ${moduleDirActual}\n`);
				// Same real-shape fixture as the sibling rollback test above: the
				// section is keyed by PATH, not the bare manifest name.
				writeFileSync(
					gitmodulesPath,
					`[submodule ".repos/${name}"]\n\tpath = .repos/${name}\n\turl = ${upstreamUrl}\n`,
				);

				const fetchFailure = GitCommandError.make({
					kind: "failed",
					args: ["fetch", "--depth", "1", "origin", "1.0.0"],
					cwd: repoDir,
					stderr: "unable to access upstream",
				});

				const gitStub = Git.layerTest({
					lsRemote: () => Effect.succeed([LsRemoteEntry.make({ sha: "0".repeat(40), ref: "refs/tags/1.0.0" })]),
					lsFiles: () => Effect.succeed([]),
					submoduleAdd: () => Effect.succeed(undefined),
					configSet: () => Effect.succeed(undefined),
					fetchAny: () => Effect.fail(fetchFailure),
					// Real `git submodule deinit --force` clears the submodule's
					// working tree -- the `.git` pointer file included. The stub
					// reproduces exactly that disk effect so this test actually
					// discriminates the read-before-deinit ordering fix: a resolver
					// read placed AFTER this runs would find no pointer file at all.
					submoduleDeinit: () =>
						Effect.sync(() => {
							rmSync(repoDir, { recursive: true, force: true });
						}),
					rm: () => Effect.succeed(undefined),
				});

				const configStoreLayer = ReposConfigStore.layer.pipe(Layer.provide(NodeServices.layer));
				const managerLayer = ReposManager.layer.pipe(
					Layer.provide(configStoreLayer),
					Layer.provide(gitStub),
					Layer.provide(reposLockdownLayer),
					Layer.provide(NodeServices.layer),
				);
				const runExit = <A, E>(effect: Effect.Effect<A, E, ReposManager>) =>
					Effect.exit(effect.pipe(Effect.provide(managerLayer)) as Effect.Effect<A, E>);

				const exit = yield* runExit(
					Effect.gen(function* () {
						const manager = yield* ReposManager;
						return yield* manager.add(root, { url: upstreamUrl, ref: "1.0.0", purpose: "spec authority", name });
					}),
				);

				expect(exit._tag).toBe("Failure");

				// The REAL, pointed-at module gitdir was removed by rollback...
				expect(existsSync(moduleDirActual)).toBe(false);
				// ...and the name-based fallback -- which never existed -- was never
				// created or otherwise touched, proving the resolver was NOT reading
				// a degraded fallback path.
				expect(existsSync(moduleDirFallback)).toBe(false);
				const gitmodulesAfter = existsSync(gitmodulesPath) ? readFileSync(gitmodulesPath, "utf8") : "";
				expect(gitmodulesAfter).not.toContain(`submodule ".repos/${name}"`);
			}),
	);
});

describe("ReposManager lockdown integration", REAL_GIT_TIMEOUT, () => {
	let previousAllowProtocol: string | undefined;
	// Every root `makeUpstream`/`makeHost` creates in this suite, so `afterAll`
	// can restore write permission (lockdown may leave a tree read-only) before
	// removing it — otherwise these tmp dirs leak on every run.
	const createdRoots: string[] = [];

	/** Recursively `chmod u+w` so a lockdown-locked tree can be removed. */
	function makeRemovable(dir: string): void {
		let entries: Array<{ name: string; isDirectory(): boolean }>;
		try {
			entries = readdirSync(dir, { withFileTypes: true });
		} catch {
			return;
		}
		for (const entry of entries) {
			const entryPath = join(dir, entry.name);
			if (entry.isDirectory()) {
				chmodSync(entryPath, statSync(entryPath).mode | 0o200);
				makeRemovable(entryPath);
			} else {
				chmodSync(entryPath, statSync(entryPath).mode | 0o200);
			}
		}
		chmodSync(dir, statSync(dir).mode | 0o200);
	}

	beforeAll(() => {
		previousAllowProtocol = process.env.GIT_ALLOW_PROTOCOL;
		process.env.GIT_ALLOW_PROTOCOL = "file";
	});

	afterAll(() => {
		if (previousAllowProtocol === undefined) {
			delete process.env.GIT_ALLOW_PROTOCOL;
		} else {
			process.env.GIT_ALLOW_PROTOCOL = previousAllowProtocol;
		}
		for (const root of createdRoots) {
			makeRemovable(root);
			rmSync(root, { recursive: true, force: true });
		}
	});

	/** Upstream fixture with two tags so `pin` has somewhere to move to. */
	function makeUpstream(): string {
		const up = mkdtempSync(join(tmpdir(), "repos-manager-lockdown-upstream-"));
		createdRoots.push(up);
		git(up, "init", "--quiet", "-b", "main");
		git(up, "config", "commit.gpgsign", "false");
		mkdirSync(join(up, "src"), { recursive: true });
		writeFileSync(join(up, "src", "keep.ts"), "export const keep = true;\n");
		git(up, "add", "-A");
		git(up, "commit", "--quiet", "-m", "initial");
		git(up, "tag", "tag1");
		writeFileSync(join(up, "src", "keep.ts"), "export const keep = false;\n");
		git(up, "add", "-A");
		git(up, "commit", "--quiet", "-m", "second");
		git(up, "tag", "tag2");
		return up;
	}

	function makeHost(): string {
		const host = mkdtempSync(join(tmpdir(), "repos-manager-lockdown-host-"));
		createdRoots.push(host);
		git(host, "init", "--quiet", "-b", "main");
		execFileSync("git", ["config", "protocol.file.allow", "always"], { cwd: host });
		git(host, "config", "commit.gpgsign", "false");
		writeFileSync(join(host, "README.md"), "# host\n");
		git(host, "add", "-A");
		git(host, "commit", "--quiet", "-m", "initial");
		return host;
	}

	/** Simulate a prior `repos add`: register the submodule, pin it to `ref`, commit it, then blow away the worktree. */
	function simulatePriorAdd(host: string, upstreamUrl: string, name: string, ref: string): void {
		execFileSync("git", ["submodule", "add", upstreamUrl, `.repos/${name}`], {
			cwd: host,
			env: { ...process.env, ...GIT_ENV, GIT_ALLOW_PROTOCOL: "file" },
		});
		git(join(host, ".repos", name), "checkout", ref);
		git(host, "add", ".repos", ".gitmodules");
		git(host, "commit", "--quiet", "-m", `add ${name} submodule`);
		rmSync(join(host, ".repos", name), { recursive: true, force: true });
	}

	/**
	 * Recursion helper for {@link firstFileUnder}: returns the first regular
	 * file found under `dir`, or `undefined` if the subtree holds none (an
	 * empty subdirectory is a legitimate "keep looking" outcome, not an
	 * error — only the top-level call throws when nothing is found anywhere).
	 */
	function findFileUnder(dir: string): string | undefined {
		for (const entry of readdirSync(dir, { withFileTypes: true })) {
			const entryPath = join(dir, entry.name);
			if (entry.isDirectory()) {
				const found = findFileUnder(entryPath);
				if (found !== undefined) {
					return found;
				}
			} else {
				return entryPath;
			}
		}
		return undefined;
	}

	/** Walk `dir` for the first regular file found, so a mode assertion has a concrete target. */
	function firstFileUnder(dir: string): string {
		const found = findFileUnder(dir);
		if (found === undefined) {
			throw new Error(`no file found under ${dir}`);
		}
		return found;
	}

	const managerLayerWithLockdown = ReposManager.layer.pipe(
		Layer.provide(ReposConfigStore.layer.pipe(Layer.provide(NodeServices.layer))),
		Layer.provide(Git.layer.pipe(Layer.provide(NodeServices.layer))),
		Layer.provide(reposLockdownLayer),
		Layer.provide(NodeServices.layer),
	);
	const run = <A, E>(effect: Effect.Effect<A, E, ReposManager>) =>
		effect.pipe(Effect.provide(managerLayerWithLockdown)) as Effect.Effect<A, E>;

	it.effect("sync leaves every present vendored tree read-only", () =>
		Effect.gen(function* () {
			const up = makeUpstream();
			const host = makeHost();
			const name = "spec";
			const upstreamUrl = `file://${up}`;

			mkdirSync(join(host, ".repos"), { recursive: true });
			writeFileSync(
				join(host, ".repos", "config.json"),
				JSON.stringify({ repos: { [name]: { url: upstreamUrl, ref: "tag1", purpose: "test" } } }),
			);
			simulatePriorAdd(host, upstreamUrl, name, "tag1");

			yield* run(
				Effect.gen(function* () {
					const manager = yield* ReposManager;
					return yield* manager.sync(host);
				}),
			);

			const file = firstFileUnder(join(host, ".repos", name));
			expect(statSync(file).mode & 0o777).toBe(0o444);
			// Mode bits don't bind root (container CI commonly runs as root), so
			// only assert the write actually gets rejected when we're not root.
			// The mode assertion above stays unconditional either way.
			if (process.getuid?.() !== 0) {
				expect(() => writeFileSync(join(host, ".repos", name, "smuggled.txt"), "x")).toThrow(/EACCES|EPERM/);
			}
		}),
	);

	it.effect("add ends locked and pin relocks after mutating", () =>
		Effect.gen(function* () {
			const up = makeUpstream();
			const host = makeHost();
			const name = "spec";
			const upstreamUrl = `file://${up}`;

			yield* run(
				Effect.gen(function* () {
					const manager = yield* ReposManager;
					return yield* manager.add(host, { url: upstreamUrl, ref: "tag1", purpose: "test", name });
				}),
			);
			expect(statSync(firstFileUnder(join(host, ".repos", name))).mode & 0o777).toBe(0o444);

			yield* run(
				Effect.gen(function* () {
					const manager = yield* ReposManager;
					return yield* manager.pin(host, name, "tag2");
				}),
			);
			expect(statSync(firstFileUnder(join(host, ".repos", name))).mode & 0o777).toBe(0o444);
		}),
	);

	it.effect("status succeeds against a locked tree and reports dirty=false", () =>
		Effect.gen(function* () {
			const up = makeUpstream();
			const host = makeHost();
			const name = "spec";
			const upstreamUrl = `file://${up}`;

			mkdirSync(join(host, ".repos"), { recursive: true });
			writeFileSync(
				join(host, ".repos", "config.json"),
				JSON.stringify({ repos: { [name]: { url: upstreamUrl, ref: "tag1", purpose: "test" } } }),
			);
			simulatePriorAdd(host, upstreamUrl, name, "tag1");

			yield* run(
				Effect.gen(function* () {
					const manager = yield* ReposManager;
					yield* manager.sync(host);
				}),
			);

			const report = yield* run(
				Effect.gen(function* () {
					const manager = yield* ReposManager;
					return yield* manager.status(host);
				}),
			);

			const entry = report.repos.find((r) => r.name === name);
			expect(entry?.dirty).toBe(false);
		}),
	);
});

describe("ReposManager.status — propagates git failures", () => {
	it.effect("fails with GitSubmoduleError instead of reporting a clean/null status when the git invocation fails", () =>
		Effect.gen(function* () {
			const root = mkdtempSync(join(tmpdir(), "repos-manager-status-git-fail-"));

			const manifest: ReposManifestFile = {
				repos: { spec: { url: "https://example.com/spec.git", ref: "1.0.0", purpose: "spec authority" } },
			};
			const configStoreStub = Layer.succeed(ReposConfigStore, {
				exists: () => Effect.succeed(true),
				read: () => Effect.succeed(manifest),
				write: () => Effect.succeed(undefined),
			} as never);

			// A Git service whose every invocation fails: before the fix, status
			// swallowed this via orElseSucceed and reported commit null / dirty
			// false as if everything were fine.
			const gitFailure = GitCommandError.make({
				kind: "failed",
				args: ["ls-tree", "HEAD"],
				cwd: root,
				stderr: "git exploded",
			});
			const failingGitStub = Layer.succeed(Git, {
				lsTree: () => Effect.fail(gitFailure),
				status: () => Effect.fail(gitFailure),
			} as never);

			const exit = yield* Effect.exit(
				Effect.gen(function* () {
					const manager = yield* ReposManager;
					return yield* manager.status(root);
				}).pipe(
					Effect.provide(ReposManager.layer),
					Effect.provide(configStoreStub),
					Effect.provide(failingGitStub),
					Effect.provide(reposLockdownLayer),
					Effect.provide(NodeServices.layer),
				) as Effect.Effect<unknown, unknown>,
			);

			expect(exit._tag).toBe("Failure");
			if (exit._tag === "Failure") {
				expect(Option.getOrThrow(Cause.findErrorOption(exit.cause))).toMatchObject({ _tag: "GitSubmoduleError" });
			}
		}),
	);
});

describe("ReposManager.note", () => {
	const baseEntry = { url: "https://example.com/spec.git", ref: "1.0.0", purpose: "spec authority" };

	function makeConfigStore(initial: ReposManifestFile) {
		let manifest: ReposManifestFile = initial;
		const configStore = Layer.succeed(ReposConfigStore, {
			exists: () => Effect.succeed(true),
			read: () => Effect.succeed(manifest),
			write: (_root: string, next: ReposManifestFile) =>
				Effect.sync(() => {
					manifest = next;
				}),
			// `note` now writes through `update`; this single-fiber stub applies
			// `fn` to the current in-memory manifest and persists the result --
			// no lock needed since the test suite drives one call at a time.
			update: (
				_root: string,
				fn: (m: ReposManifestFile) => ReposManifestFile | Effect.Effect<ReposManifestFile, never>,
			) =>
				Effect.gen(function* () {
					const result = fn(manifest);
					const next = Effect.isEffect(result) ? yield* result : result;
					manifest = next;
					return next;
				}),
		} as never);
		return { configStore, getManifest: () => manifest };
	}

	// `note` operates on the manifest only — no git command ever runs — so an
	// empty Git stub satisfies `ReposManager.layer`'s requirement without spawning.
	const gitStub = Layer.succeed(Git, {} as never);

	// Per-test provide is REQUIRED in both helpers: `configStore` is a parameter carrying the
	// per-test manifest fixture, so the layer genuinely varies test by test.
	function run<A, E>(effect: Effect.Effect<A, E, ReposManager>, configStore: Layer.Layer<ReposConfigStore>) {
		return effect.pipe(
			Effect.provide(ReposManager.layer),
			Effect.provide(configStore),
			Effect.provide(gitStub),
			Effect.provide(reposLockdownLayer),
			Effect.provide(NodeServices.layer),
		) as Effect.Effect<A, E>;
	}

	function runExit<A>(effect: Effect.Effect<A, unknown, ReposManager>, configStore: Layer.Layer<ReposConfigStore>) {
		return Effect.exit(
			effect.pipe(
				Effect.provide(ReposManager.layer),
				Effect.provide(configStore),
				Effect.provide(gitStub),
				Effect.provide(reposLockdownLayer),
				Effect.provide(NodeServices.layer),
			) as Effect.Effect<unknown, unknown>,
		);
	}

	// `it.live`, NOT `it.effect`: the expectation is built from `new Date()` (never intercepted)
	// while the subject stamps the date from Effect's Clock (manager.ts:433). Under the virtual
	// clock that compares today's date against 1970-01-01 and fails.
	it.live("add stamps an n-prefixed id, today's date, and the entry's current ref", () =>
		Effect.gen(function* () {
			const { configStore, getManifest } = makeConfigStore({ repos: { spec: baseEntry } });
			const root = "/virtual/root";
			const today = new Date().toISOString().slice(0, 10);

			const result: ReposNoteResult = yield* run(
				Effect.gen(function* () {
					const manager = yield* ReposManager;
					return yield* manager.note(root, "spec", { op: "add", note: "first note" });
				}),
				configStore,
			);

			expect(result.name).toBe("spec");
			expect(result.op).toBe("add");
			expect(result.id).toMatch(/^n-[0-9a-f]{4}$/);
			expect(result.noteCount).toBe(1);

			const notes = getManifest().repos.spec?.notes ?? [];
			expect(notes).toHaveLength(1);
			expect(notes[0]).toMatchObject({ id: result.id, date: today, ref: "1.0.0", note: "first note" });
		}),
	);

	it.effect("fails the 11th add with the note-limit message", () =>
		Effect.gen(function* () {
			const seedNotes = Array.from({ length: 10 }, (_, i) => ({
				id: `n-seed${i}`,
				date: "2026-01-01",
				ref: "1.0.0",
				note: `seed note ${i}`,
			}));
			const { configStore } = makeConfigStore({ repos: { spec: { ...baseEntry, notes: seedNotes } } });
			const root = "/virtual/root";

			const exit = yield* runExit(
				Effect.gen(function* () {
					const manager = yield* ReposManager;
					return yield* manager.note(root, "spec", { op: "add", note: "one too many" });
				}),
				configStore,
			);

			expect(exit._tag).toBe("Failure");
			if (exit._tag === "Failure") {
				expect(Option.getOrThrow(Cause.findErrorOption(exit.cause))).toMatchObject({
					_tag: "ReposConfigError",
					reason: "note limit (10) reached for spec; promote or remove notes first",
				});
			}
		}),
	);

	it.effect("remove drops the note by id and reports the remaining count", () =>
		Effect.gen(function* () {
			const { configStore, getManifest } = makeConfigStore({
				repos: {
					spec: {
						...baseEntry,
						notes: [
							{ id: "n-aaaa", date: "2026-01-01", ref: "1.0.0", note: "keep me" },
							{ id: "n-bbbb", date: "2026-01-01", ref: "1.0.0", note: "remove me" },
						],
					},
				},
			});
			const root = "/virtual/root";

			const result = yield* run(
				Effect.gen(function* () {
					const manager = yield* ReposManager;
					return yield* manager.note(root, "spec", { op: "remove", id: "n-bbbb" });
				}),
				configStore,
			);

			expect(result).toEqual({ name: "spec", op: "remove", id: "n-bbbb", noteCount: 1 });
			expect(getManifest().repos.spec?.notes?.map((n) => n.id)).toEqual(["n-aaaa"]);
		}),
	);

	it.effect("remove fails with NoteNotFoundError for an unknown id", () =>
		Effect.gen(function* () {
			const { configStore } = makeConfigStore({ repos: { spec: { ...baseEntry, notes: [] } } });
			const root = "/virtual/root";

			const exit = yield* runExit(
				Effect.gen(function* () {
					const manager = yield* ReposManager;
					return yield* manager.note(root, "spec", { op: "remove", id: "does-not-exist" });
				}),
				configStore,
			);

			expect(exit._tag).toBe("Failure");
			if (exit._tag === "Failure") {
				expect(Option.getOrThrow(Cause.findErrorOption(exit.cause))).toMatchObject({
					_tag: "NoteNotFoundError",
					name: "spec",
					id: "does-not-exist",
				});
			}
		}),
	);

	it.effect("promote moves note text into orientation.startHere and removes the note", () =>
		Effect.gen(function* () {
			const { configStore, getManifest } = makeConfigStore({
				repos: {
					spec: {
						...baseEntry,
						notes: [{ id: "n-cccc", date: "2026-01-01", ref: "1.0.0", note: "start reading at src/index.ts" }],
					},
				},
			});
			const root = "/virtual/root";

			const result = yield* run(
				Effect.gen(function* () {
					const manager = yield* ReposManager;
					return yield* manager.note(root, "spec", { op: "promote", id: "n-cccc", into: "startHere" });
				}),
				configStore,
			);

			expect(result).toEqual({ name: "spec", op: "promote", id: "n-cccc", noteCount: 0 });
			const entry = getManifest().repos.spec;
			expect(entry?.orientation?.startHere).toBe("start reading at src/index.ts");
			expect(entry?.notes).toEqual([]);
		}),
	);

	// #377: a second promotion into an already-populated orientation field used
	// to overwrite the first outright, destroying it with no warning.
	it.effect("promote onto an existing orientation field appends rather than overwrites (#377)", () =>
		Effect.gen(function* () {
			const { configStore, getManifest } = makeConfigStore({
				repos: {
					spec: {
						...baseEntry,
						orientation: { layout: "src/ holds the implementation" },
						notes: [{ id: "n-dddd", date: "2026-01-01", ref: "1.0.0", note: "docs/ holds the spec" }],
					},
				},
			});
			const root = "/virtual/root";

			const result = yield* run(
				Effect.gen(function* () {
					const manager = yield* ReposManager;
					return yield* manager.note(root, "spec", { op: "promote", id: "n-dddd", into: "layout" });
				}),
				configStore,
			);

			expect(result).toEqual({ name: "spec", op: "promote", id: "n-dddd", noteCount: 0 });
			const entry = getManifest().repos.spec;
			expect(entry?.orientation?.layout).toBe("src/ holds the implementation\n\ndocs/ holds the spec");
			expect(entry?.notes).toEqual([]);
		}),
	);

	it.effect("promote onto an absent orientation field sets it plainly", () =>
		Effect.gen(function* () {
			const { configStore, getManifest } = makeConfigStore({
				repos: {
					spec: {
						...baseEntry,
						notes: [{ id: "n-eeee", date: "2026-01-01", ref: "1.0.0", note: "start reading at src/index.ts" }],
					},
				},
			});
			const root = "/virtual/root";

			const result = yield* run(
				Effect.gen(function* () {
					const manager = yield* ReposManager;
					return yield* manager.note(root, "spec", { op: "promote", id: "n-eeee", into: "startHere" });
				}),
				configStore,
			);

			expect(result).toEqual({ name: "spec", op: "promote", id: "n-eeee", noteCount: 0 });
			const entry = getManifest().repos.spec;
			expect(entry?.orientation?.startHere).toBe("start reading at src/index.ts");
			expect(entry?.notes).toEqual([]);
		}),
	);

	it.effect("promote fails with NoteNotFoundError for an unknown id", () =>
		Effect.gen(function* () {
			const { configStore } = makeConfigStore({ repos: { spec: { ...baseEntry, notes: [] } } });
			const root = "/virtual/root";

			const exit = yield* runExit(
				Effect.gen(function* () {
					const manager = yield* ReposManager;
					return yield* manager.note(root, "spec", { op: "promote", id: "does-not-exist", into: "layout" });
				}),
				configStore,
			);

			expect(exit._tag).toBe("Failure");
			if (exit._tag === "Failure") {
				expect(Option.getOrThrow(Cause.findErrorOption(exit.cause))).toMatchObject({
					_tag: "NoteNotFoundError",
					name: "spec",
					id: "does-not-exist",
				});
			}
		}),
	);

	it.effect("produces distinct ids for identical note text (collision extends to 8 hex chars)", () =>
		Effect.gen(function* () {
			const { configStore } = makeConfigStore({ repos: { spec: baseEntry } });
			const root = "/virtual/root";

			const first = yield* run(
				Effect.gen(function* () {
					const manager = yield* ReposManager;
					return yield* manager.note(root, "spec", { op: "add", note: "same text" });
				}),
				configStore,
			);

			const second = yield* run(
				Effect.gen(function* () {
					const manager = yield* ReposManager;
					return yield* manager.note(root, "spec", { op: "add", note: "same text" });
				}),
				configStore,
			);

			expect(first.id).not.toBe(second.id);
			expect(first.id).toMatch(/^n-[0-9a-f]{4}$/);
			expect(second.id).toMatch(/^n-[0-9a-f]{8}$/);
		}),
	);

	it.effect("extends past 8 hex chars for a third identical note, keeping all three ids distinct", () =>
		Effect.gen(function* () {
			const { configStore, getManifest } = makeConfigStore({ repos: { spec: baseEntry } });
			const root = "/virtual/root";

			const first = yield* run(
				Effect.gen(function* () {
					const manager = yield* ReposManager;
					return yield* manager.note(root, "spec", { op: "add", note: "same text" });
				}),
				configStore,
			);
			const second = yield* run(
				Effect.gen(function* () {
					const manager = yield* ReposManager;
					return yield* manager.note(root, "spec", { op: "add", note: "same text" });
				}),
				configStore,
			);
			const third = yield* run(
				Effect.gen(function* () {
					const manager = yield* ReposManager;
					return yield* manager.note(root, "spec", { op: "add", note: "same text" });
				}),
				configStore,
			);

			const ids = [first.id, second.id, third.id];
			expect(new Set(ids).size).toBe(3);
			expect(third.id).toMatch(/^n-[0-9a-f]{12}$/);
			expect(getManifest().repos.spec?.notes).toHaveLength(3);

			// Removing the second id removes exactly one note.
			const afterRemove = yield* run(
				Effect.gen(function* () {
					const manager = yield* ReposManager;
					return yield* manager.note(root, "spec", { op: "remove", id: second.id });
				}),
				configStore,
			);
			expect(afterRemove.noteCount).toBe(2);
			expect(getManifest().repos.spec?.notes?.map((n) => n.id)).toEqual([first.id, third.id]);
		}),
	);

	it.effect("fails with RepoNotFoundError when the repo is absent from the manifest", () =>
		Effect.gen(function* () {
			const { configStore } = makeConfigStore({ repos: {} });
			const root = "/virtual/root";

			const exit = yield* runExit(
				Effect.gen(function* () {
					const manager = yield* ReposManager;
					return yield* manager.note(root, "does-not-exist", { op: "add", note: "hello" });
				}),
				configStore,
			);

			expect(exit._tag).toBe("Failure");
			if (exit._tag === "Failure") {
				expect(Option.getOrThrow(Cause.findErrorOption(exit.cause))).toMatchObject({
					_tag: "RepoNotFoundError",
					name: "does-not-exist",
				});
			}
		}),
	);
});

describe("ReposManager.remove — real git", REAL_GIT_TIMEOUT, () => {
	let previousAllowProtocol: string | undefined;

	beforeAll(() => {
		previousAllowProtocol = process.env.GIT_ALLOW_PROTOCOL;
		process.env.GIT_ALLOW_PROTOCOL = "file";
	});

	afterAll(() => {
		if (previousAllowProtocol === undefined) {
			delete process.env.GIT_ALLOW_PROTOCOL;
		} else {
			process.env.GIT_ALLOW_PROTOCOL = previousAllowProtocol;
		}
	});

	function makeUpstream(): string {
		const up = mkdtempSync(join(tmpdir(), "repos-manager-remove-upstream-"));
		git(up, "init", "--quiet", "-b", "main");
		git(up, "config", "commit.gpgsign", "false");
		writeFileSync(join(up, "README.md"), "# upstream\n");
		git(up, "add", "-A");
		git(up, "commit", "--quiet", "-m", "initial");
		git(up, "tag", "1.0.0");
		return up;
	}

	function makeHost(): string {
		const host = mkdtempSync(join(tmpdir(), "repos-manager-remove-host-"));
		git(host, "init", "--quiet", "-b", "main");
		execFileSync("git", ["config", "protocol.file.allow", "always"], { cwd: host });
		git(host, "config", "commit.gpgsign", "false");
		writeFileSync(join(host, "README.md"), "# host\n");
		git(host, "add", "-A");
		git(host, "commit", "--quiet", "-m", "initial");
		return host;
	}

	function makeManagerLayer() {
		const configStoreLayer = ReposConfigStore.layer.pipe(Layer.provide(NodeServices.layer));
		return ReposManager.layer.pipe(
			Layer.provide(configStoreLayer),
			Layer.provide(Git.layer.pipe(Layer.provide(NodeServices.layer))),
			Layer.provide(reposLockdownLayer),
			Layer.provide(NodeServices.layer),
		);
	}

	it.effect(
		"removes a healthy vendored repo end-to-end: gitlink, worktree, module gitdir, and .gitmodules section all gone; manifest entry dropped; result carries notes",
		() =>
			Effect.gen(function* () {
				const up = makeUpstream();
				const host = makeHost();
				const name = "spec";
				const upstreamUrl = `file://${up}`;

				const managerLayer = makeManagerLayer();
				const run = <A, E>(effect: Effect.Effect<A, E, ReposManager>) =>
					effect.pipe(Effect.provide(managerLayer)) as Effect.Effect<A, E>;

				yield* run(
					Effect.gen(function* () {
						const manager = yield* ReposManager;
						return yield* manager.add(host, { url: upstreamUrl, ref: "1.0.0", purpose: "spec authority", name });
					}),
				);
				git(host, "commit", "--quiet", "-m", "add spec submodule");

				// Pre-seed a note against the current ref, as `note` (Task 5) would
				// have, and commit it so it's part of the stable baseline `remove`
				// operates against.
				const manifestPath = join(host, ".repos", "config.json");
				const manifestAfterAdd = JSON.parse(readFileSync(manifestPath, "utf8")) as ReposManifestFile;
				const addedEntry = manifestAfterAdd.repos[name];
				if (!addedEntry) {
					throw new Error("expected manifest entry to exist after add");
				}
				const seededNote = { id: "note-1", date: "2026-07-12", ref: "1.0.0", note: "written against 1.0.0" };
				const manifestWithNote: ReposManifestFile = {
					repos: { ...manifestAfterAdd.repos, [name]: { ...addedEntry, notes: [seededNote] } },
				};
				writeFileSync(manifestPath, `${JSON.stringify(manifestWithNote, null, "\t")}\n`);
				git(host, "add", ".repos/config.json");
				git(host, "commit", "--quiet", "-m", "seed note");

				const moduleDir = join(host, ".git", "modules", ".repos", name);
				expect(existsSync(moduleDir)).toBe(true);

				const removeResult: ReposRemoveResult = yield* run(
					Effect.gen(function* () {
						const manager = yield* ReposManager;
						return yield* manager.remove(host, name);
					}),
				);

				expect(removeResult).toEqual({
					name,
					path: `.repos/${name}`,
					commitMessage: `chore(repos): remove ${name}`,
					removedNotes: [seededNote],
					// The whole entry comes back so a remove-then-re-add remedy can
					// hand `orientation` straight to `add` instead of dropping it.
					removedEntry: { ...addedEntry, notes: [seededNote] },
				});

				// Gitlink gone from the index.
				expect(git(host, "ls-files", "--stage", `.repos/${name}`).trim()).toBe("");

				// Worktree and module gitdir both gone.
				expect(existsSync(join(host, ".repos", name))).toBe(false);
				expect(existsSync(moduleDir)).toBe(false);

				// .gitmodules section gone, file still parses (git itself accepts it).
				const gitmodulesText = readFileSync(join(host, ".gitmodules"), "utf8");
				expect(gitmodulesText).not.toContain(`.repos/${name}`);
				expect(() => git(host, "config", "--file", ".gitmodules", "--list")).not.toThrow();

				// Manifest entry gone.
				const manifestAfterRemove = JSON.parse(readFileSync(manifestPath, "utf8")) as ReposManifestFile;
				expect(manifestAfterRemove.repos[name]).toBeUndefined();

				// Staged paths correct.
				const staged = git(host, "diff", "--cached", "--name-only").trim().split("\n").filter(Boolean);
				expect(staged).toEqual(expect.arrayContaining([".gitmodules", ".repos/config.json"]));
			}),
	);

	it.effect(
		"finds and removes a .gitmodules section registered under a name that diverges from the manifest key, pairing by path",
		() =>
			Effect.gen(function* () {
				// The re-slugged-after-vendoring shape: the manifest key
				// ("effect") differs from the .gitmodules section name
				// ("legacy-name") but the section's own `path` field still names
				// the manifest-derived path.
				const root = mkdtempSync(join(tmpdir(), "repos-manager-remove-divergent-"));
				git(root, "init", "--quiet", "-b", "main");
				git(root, "config", "commit.gpgsign", "false");
				const name = "effect";
				const repoDir = join(root, ".repos", name);
				const moduleDirActual = join(root, ".git", "modules", ".repos", "legacy-name");

				mkdirSync(repoDir, { recursive: true });
				writeFileSync(join(repoDir, "marker.txt"), "worktree\n");
				mkdirSync(moduleDirActual, { recursive: true });
				writeFileSync(join(moduleDirActual, "marker.txt"), "gitdir\n");
				writeFileSync(join(repoDir, ".git"), `gitdir: ${moduleDirActual}\n`);
				const gitmodulesPath = join(root, ".gitmodules");
				writeFileSync(
					gitmodulesPath,
					`[submodule "legacy-name"]\n\tpath = .repos/${name}\n\turl = https://example.com/effect.git\n`,
				);
				writeFileSync(join(root, ".repos", "config.json"), `${JSON.stringify({ repos: {} }, null, "\t")}\n`);
				git(root, "add", "-A");
				git(root, "commit", "--quiet", "-m", "seed divergent fixture");

				const manifest: ReposManifestFile = {
					repos: { [name]: { url: "https://example.com/effect.git", ref: "1.0.0", purpose: "vendored source" } },
				};
				const configStoreStub = Layer.succeed(ReposConfigStore, {
					exists: () => Effect.succeed(true),
					read: () => Effect.succeed(manifest),
					write: () => Effect.succeed(undefined),
					update: (_root: string, fn: (m: ReposManifestFile) => ReposManifestFile) => Effect.succeed(fn(manifest)),
				} as never);

				const gitStub = Git.layerTest({
					submoduleDeinit: () =>
						Effect.sync(() => {
							rmSync(repoDir, { recursive: true, force: true });
						}),
					rm: () => Effect.succeed(undefined),
					add: () => Effect.succeed(undefined),
				});

				const managerLayer = ReposManager.layer.pipe(
					Layer.provide(configStoreStub),
					Layer.provide(gitStub),
					Layer.provide(reposLockdownLayer),
					Layer.provide(NodeServices.layer),
				);

				const removeResult: ReposRemoveResult = yield* Effect.gen(function* () {
					const manager = yield* ReposManager;
					return yield* manager.remove(root, name);
				}).pipe(Effect.provide(managerLayer)) as Effect.Effect<ReposRemoveResult>;

				expect(removeResult.name).toBe(name);
				expect(removeResult.path).toBe(`.repos/${name}`);

				const gitmodulesAfter = readFileSync(gitmodulesPath, "utf8");
				expect(gitmodulesAfter).not.toContain("legacy-name");
				expect(gitmodulesAfter).not.toContain(`.repos/${name}`);
			}),
	);

	it.effect(
		"fails with RepoNotFoundError for a name absent from the manifest, touching neither git nor the filesystem",
		() =>
			Effect.gen(function* () {
				const configStoreStub = Layer.succeed(ReposConfigStore, {
					exists: () => Effect.succeed(true),
					read: () => Effect.succeed({ repos: {} } as ReposManifestFile),
					write: () => Effect.succeed(undefined),
				} as never);

				const root = mkdtempSync(join(tmpdir(), "repos-manager-remove-missing-"));

				// `remove` fails at the manifest lookup before any git call, so an
				// empty Git stub satisfies `ReposManager.layer`'s requirement without
				// spawning.
				const gitStub = Layer.succeed(Git, {} as never);

				const exit = yield* Effect.exit(
					Effect.gen(function* () {
						const manager = yield* ReposManager;
						return yield* manager.remove(root, "does-not-exist");
					}).pipe(
						Effect.provide(ReposManager.layer),
						Effect.provide(configStoreStub),
						Effect.provide(gitStub),
						Effect.provide(reposLockdownLayer),
						Effect.provide(NodeServices.layer),
					) as Effect.Effect<unknown, unknown>,
				);

				expect(exit._tag).toBe("Failure");
				if (exit._tag === "Failure") {
					expect(Option.getOrThrow(Cause.findErrorOption(exit.cause))).toMatchObject({
						_tag: "RepoNotFoundError",
						name: "does-not-exist",
					});
				}
			}),
	);
});

/**
 * Task 11 real-git probe: pins EXACTLY what `git mv` does (and does not do)
 * to a submodule on the installed git 2.54, ahead of and independent from
 * `ReposManager.rename` -- so the production sequence only redoes what git
 * actually leaves broken.
 *
 * Findings (documented here because a future git upgrade could change any of
 * them, and this test would then fail loudly rather than the assumption
 * silently rotting inside `rename`'s comments):
 *
 * 1. `git mv <old> <new>` on a submodule path DOES already rewrite AND stage
 *    `.gitmodules`' `path` field to the new path -- `rename` must not redo
 *    this.
 * 2. It does NOT rename the `.gitmodules` SECTION NAME (the `[submodule
 *    "..."]` header) -- that stays whatever it was before the move. `rename`
 *    must canonicalize this itself via `Gitmodules.rename`.
 * 3. It DOES already recompute `core.worktree` in the module's own
 *    `.git/modules/.../config` to the new relative path -- contrary to the
 *    #363/#377 postmortems' assumption, this is NOT broken on git 2.54.
 *    `rename` still re-asserts it defensively (idempotent) rather than
 *    trusting this to hold on every future git version.
 * 4. `extensions.worktreeConfig` is not set by a plain `submodule add`, so no
 *    `config.worktree` file exists in the module dir -- `rename` only
 *    touches that file when it's actually present.
 * 5. Both the `.gitmodules` update and the worktree move are staged as part
 *    of the SAME `git mv` invocation (`git status --porcelain` shows `M `
 *    and `R ` -- staged column only, clean unstaged column) -- no separate
 *    `git add` is needed for either.
 */
describe("git mv on a submodule (real git) — Task 11 probe", REAL_GIT_TIMEOUT, () => {
	let previousAllowProtocol: string | undefined;

	beforeAll(() => {
		previousAllowProtocol = process.env.GIT_ALLOW_PROTOCOL;
		process.env.GIT_ALLOW_PROTOCOL = "file";
	});

	afterAll(() => {
		if (previousAllowProtocol === undefined) {
			delete process.env.GIT_ALLOW_PROTOCOL;
		} else {
			process.env.GIT_ALLOW_PROTOCOL = previousAllowProtocol;
		}
	});

	it("mv already updates .gitmodules' path + stages both, recomputes core.worktree, leaves the section name and config.worktree alone", () => {
		const up = mkdtempSync(join(tmpdir(), "repos-manager-mv-probe-upstream-"));
		git(up, "init", "--quiet", "-b", "main");
		git(up, "config", "commit.gpgsign", "false");
		writeFileSync(join(up, "README.md"), "# upstream\n");
		git(up, "add", "-A");
		git(up, "commit", "--quiet", "-m", "initial");
		git(up, "tag", "1.0.0");

		const host = mkdtempSync(join(tmpdir(), "repos-manager-mv-probe-host-"));
		git(host, "init", "--quiet", "-b", "main");
		execFileSync("git", ["config", "protocol.file.allow", "always"], { cwd: host });
		git(host, "config", "commit.gpgsign", "false");
		writeFileSync(join(host, "README.md"), "# host\n");
		git(host, "add", "-A");
		git(host, "commit", "--quiet", "-m", "initial");

		mkdirSync(join(host, ".repos"), { recursive: true });
		git(host, "submodule", "add", `file://${up}`, ".repos/old-name");
		git(host, "commit", "--quiet", "-m", "add submodule");

		const moduleDir = join(host, ".git", "modules", ".repos", "old-name");
		const configBefore = readFileSync(join(moduleDir, "config"), "utf8");
		expect(configBefore).toContain("worktree = ../../../../.repos/old-name");
		expect(existsSync(join(moduleDir, "config.worktree"))).toBe(false);

		git(host, "mv", ".repos/old-name", ".repos/new-name");

		// Finding 1 + 2: `.gitmodules` path updated, section name unchanged
		// (a plain `submodule add` with no `--name` defaults the section name
		// to the path it was added under, so the pre-mv name is the OLD path).
		const gitmodulesAfter = readFileSync(join(host, ".gitmodules"), "utf8");
		expect(gitmodulesAfter).toContain('[submodule ".repos/old-name"]');
		expect(gitmodulesAfter).toContain("path = .repos/new-name");

		// Finding 3: the SAME module dir on disk (never moved) has its
		// `core.worktree` recomputed to the new relative path.
		expect(existsSync(moduleDir)).toBe(true);
		expect(existsSync(join(host, ".git", "modules", ".repos", "new-name"))).toBe(false);
		const configAfter = readFileSync(join(moduleDir, "config"), "utf8");
		expect(configAfter).toContain("worktree = ../../../../.repos/new-name");

		// Finding 4: still no `config.worktree` file.
		expect(existsSync(join(moduleDir, "config.worktree"))).toBe(false);

		// Finding 5: both changes are already staged (porcelain XY: staged
		// column non-blank, unstaged column blank).
		const porcelain = git(host, "status", "--porcelain");
		const lines = porcelain
			.trim()
			.split("\n")
			.filter((line) => line.length > 0);
		const gitmodulesLine = lines.find((line) => line.includes(".gitmodules"));
		const renameLine = lines.find((line) => line.includes("new-name"));
		expect(gitmodulesLine?.[0]).toBe("M");
		expect(gitmodulesLine?.[1]).toBe(" ");
		expect(renameLine?.[0]).toBe("R");
		expect(renameLine?.[1]).toBe(" ");

		// Also pinned: `git submodule status` succeeds post-mv (the #363
		// failure mode this whole method exists to avoid regressing).
		expect(() => git(host, "submodule", "status")).not.toThrow();
	});
});

describe("ReposManager.rename — real git", REAL_GIT_TIMEOUT, () => {
	let previousAllowProtocol: string | undefined;

	beforeAll(() => {
		previousAllowProtocol = process.env.GIT_ALLOW_PROTOCOL;
		process.env.GIT_ALLOW_PROTOCOL = "file";
	});

	afterAll(() => {
		if (previousAllowProtocol === undefined) {
			delete process.env.GIT_ALLOW_PROTOCOL;
		} else {
			process.env.GIT_ALLOW_PROTOCOL = previousAllowProtocol;
		}
	});

	function makeUpstream(): string {
		const up = mkdtempSync(join(tmpdir(), "repos-manager-rename-upstream-"));
		git(up, "init", "--quiet", "-b", "main");
		git(up, "config", "commit.gpgsign", "false");
		writeFileSync(join(up, "README.md"), "# upstream\n");
		git(up, "add", "-A");
		git(up, "commit", "--quiet", "-m", "initial");
		git(up, "tag", "1.0.0");
		return up;
	}

	function makeHost(): string {
		const host = mkdtempSync(join(tmpdir(), "repos-manager-rename-host-"));
		git(host, "init", "--quiet", "-b", "main");
		execFileSync("git", ["config", "protocol.file.allow", "always"], { cwd: host });
		git(host, "config", "commit.gpgsign", "false");
		writeFileSync(join(host, "README.md"), "# host\n");
		git(host, "add", "-A");
		git(host, "commit", "--quiet", "-m", "initial");
		return host;
	}

	function makeManagerLayer() {
		const configStoreLayer = ReposConfigStore.layer.pipe(Layer.provide(NodeServices.layer));
		return ReposManager.layer.pipe(
			Layer.provide(configStoreLayer),
			Layer.provide(Git.layer.pipe(Layer.provide(NodeServices.layer))),
			Layer.provide(reposLockdownLayer),
			Layer.provide(NodeServices.layer),
		);
	}

	it.effect(
		"renames a healthy vendored repo end-to-end: worktree moved, core.worktree re-pointed, .gitmodules section canonicalized, manifest key renamed, everything staged, submodule status clean",
		() =>
			Effect.gen(function* () {
				const up = makeUpstream();
				const host = makeHost();
				const oldName = "spec";
				const newName = "spec-renamed";
				const upstreamUrl = `file://${up}`;

				const managerLayer = makeManagerLayer();
				const run = <A, E>(effect: Effect.Effect<A, E, ReposManager>) =>
					effect.pipe(Effect.provide(managerLayer)) as Effect.Effect<A, E>;

				yield* run(
					Effect.gen(function* () {
						const manager = yield* ReposManager;
						return yield* manager.add(host, {
							url: upstreamUrl,
							ref: "1.0.0",
							purpose: "spec authority",
							name: oldName,
						});
					}),
				);
				git(host, "commit", "--quiet", "-m", "add spec submodule");

				const moduleDir = join(host, ".git", "modules", ".repos", oldName);
				expect(existsSync(moduleDir)).toBe(true);

				const renameResult: ReposRenameResult = yield* run(
					Effect.gen(function* () {
						const manager = yield* ReposManager;
						return yield* manager.rename(host, oldName, newName);
					}),
				);

				expect(renameResult).toEqual({
					oldName,
					newName,
					path: `.repos/${newName}`,
					commitMessage: `chore(repos): rename ${oldName} to ${newName}`,
				});

				// Worktree only exists at the new path.
				expect(existsSync(join(host, ".repos", oldName))).toBe(false);
				expect(existsSync(join(host, ".repos", newName))).toBe(true);

				// The module dir on disk never moved -- it's still named after the
				// registration, only its `core.worktree` values changed. The value
				// is GITDIR-relative (what git itself writes -- Task 11's first
				// probe -- not an absolute or repo-root-relative path): a fix-round-2
				// real-repo rename broke `git status` repo-wide precisely because an
				// earlier version of this code wrote a bare repo-relative value
				// (".repos/<name>"), which git resolves relative to the GITDIR, not
				// the repo root -- resolving to a nonexistent nested path.
				expect(existsSync(moduleDir)).toBe(true);
				const config = readFileSync(join(moduleDir, "config"), "utf8");
				const expectedWorktreeValue = relative(moduleDir, join(host, ".repos", newName));
				expect(config).toContain(`worktree = ${expectedWorktreeValue}`);
				// Guard against a regression back to a bare repo-relative value
				// slipping past a loose `toContain` (both forms could share a
				// trailing path segment) -- assert the exact line.
				expect(config.split("\n")).toContain(`\tworktree = ${expectedWorktreeValue}`);

				// `.gitmodules` section canonicalized to the new repo path (both
				// the header name AND the path field).
				const gitmodulesText = readFileSync(join(host, ".gitmodules"), "utf8");
				expect(gitmodulesText).toContain(`[submodule ".repos/${newName}"]`);
				expect(gitmodulesText).toContain(`path = .repos/${newName}`);
				expect(gitmodulesText).not.toContain(`[submodule ".repos/${oldName}"]`);
				expect(gitmodulesText).not.toContain(`path = .repos/${oldName}\n`);

				// Manifest key renamed, entry preserved.
				const manifestPath = join(host, ".repos", "config.json");
				const manifestAfter = JSON.parse(readFileSync(manifestPath, "utf8")) as ReposManifestFile;
				expect(manifestAfter.repos[oldName]).toBeUndefined();
				expect(manifestAfter.repos[newName]).toMatchObject({
					url: upstreamUrl,
					ref: "1.0.0",
					purpose: "spec authority",
				});

				// Every git submodule status read succeeds post-rename (the #363
				// failure mode), and the full worktree status is clean apart from
				// the staged rename itself.
				expect(() => git(host, "submodule", "status")).not.toThrow();
				const porcelain = git(host, "status", "--porcelain")
					.trim()
					.split("\n")
					.filter((line) => line.length > 0);
				for (const line of porcelain) {
					// Staged column non-blank, unstaged column blank -- nothing left
					// dirty/unstaged by the rename.
					expect(line[1]).toBe(" ");
				}
				const staged = git(host, "diff", "--cached", "--name-only").trim().split("\n").filter(Boolean);
				expect(staged).toEqual(expect.arrayContaining([".gitmodules", ".repos/config.json", `.repos/${newName}`]));

				// A live post-rename repo (fix round 3) found `git submodule
				// status` reads a healthy, checked-out submodule as UNINITIALIZED
				// (`-` prefix) when the SUPERPROJECT's own `.git/config`
				// registration -- entirely separate from `.gitmodules` and the
				// module's own gitdir config -- is still keyed to the OLD section
				// name. `not.toThrow()` above can never catch this: a `-`-prefixed
				// line is a successful, zero-exit read with different CONTENT, not
				// a thrown error. Assert the content directly: no leading `-`
				// (uninitialized) or `+` (out of sync).
				const submoduleStatusLine = git(host, "submodule", "status").trimEnd();
				expect(submoduleStatusLine.startsWith("-")).toBe(false);
				expect(submoduleStatusLine.startsWith("+")).toBe(false);
				expect(submoduleStatusLine).toContain(`.repos/${newName}`);

				// `.git/config`'s submodule registration follows the rename too --
				// the NEW section name only, the OLD one unset.
				const gitConfigRegistrations = git(host, "config", "--get-regexp", "submodule\\..*").trim();
				expect(gitConfigRegistrations).toContain(`submodule..repos/${newName}.url`);
				expect(gitConfigRegistrations).not.toContain(`submodule..repos/${oldName}.url`);
			}),
	);

	it.effect(
		"writes a gitdir-resolvable core.worktree even when root is passed as a RELATIVE path (the CLI's --cwd default, and the systems#363-shaped live-repo failure)",
		() =>
			Effect.gen(function* () {
				// Every OTHER test in this file passes `root` as `mkdtempSync`'s
				// absolute return value, which made `path.join(root, newRepoPath)`
				// coincidentally absolute (and therefore correct) in every fixture
				// -- the actual bug (writing a bare repo-relative value, which git
				// resolves relative to the GITDIR, not the repo root) was invisible
				// to this whole suite until a relative `root` was exercised. This
				// is the mutation-discriminating case: a live rename via `savvy
				// repos rename` (CLI `--cwd` defaults to literal `"."`) hit exactly
				// this, and `git status` died repo-wide afterward with `fatal:
				// cannot chdir to '.repos/effect'`.
				const up = makeUpstream();
				const hostAbsolute = makeHost();
				const oldName = "spec";
				const newName = "spec-renamed";
				const upstreamUrl = `file://${up}`;

				const managerLayer = makeManagerLayer();
				const run = <A, E>(effect: Effect.Effect<A, E, ReposManager>) =>
					effect.pipe(Effect.provide(managerLayer)) as Effect.Effect<A, E>;

				yield* run(
					Effect.gen(function* () {
						const manager = yield* ReposManager;
						return yield* manager.add(hostAbsolute, {
							url: upstreamUrl,
							ref: "1.0.0",
							purpose: "spec authority",
							name: oldName,
						});
					}),
				);
				git(hostAbsolute, "commit", "--quiet", "-m", "add spec submodule");

				const previousCwd = process.cwd();
				process.chdir(hostAbsolute);
				let renameResult: ReposRenameResult;
				try {
					// The discriminating call: `root` is the literal relative string
					// `"."`, exactly what `Flag.directory("cwd").pipe(Flag.withDefault("."))`
					// hands `runReposRename` when a caller doesn't pass `--cwd`.
					renameResult = yield* run(
						Effect.gen(function* () {
							const manager = yield* ReposManager;
							return yield* manager.rename(".", oldName, newName);
						}),
					);
				} finally {
					process.chdir(previousCwd);
				}
				expect(renameResult.newName).toBe(newName);

				const moduleDir = join(hostAbsolute, ".git", "modules", ".repos", oldName);
				const config = readFileSync(join(moduleDir, "config"), "utf8");
				const expectedWorktreeValue = relative(moduleDir, join(hostAbsolute, ".repos", newName));

				// The fixed, gitdir-relative form is present...
				expect(config).toContain(`worktree = ${expectedWorktreeValue}`);
				// ...and the bug's bare repo-relative form (what `path.join(".",
				// newRepoPath)` collapses to -- no leading `./`) is NOT: this is
				// the exact string a reverted fix would write, and the exact
				// string the live repo's broken config carried.
				expect(config).not.toContain(`worktree = ${REPOS_DIR}/${newName}\n`);

				// The #363 failure mode itself: `git status` from a fresh process
				// (no inherited cwd/env assumptions) must succeed against the
				// renamed submodule.
				expect(() => git(join(hostAbsolute, ".repos", newName), "status", "--porcelain")).not.toThrow();
				expect(() => git(hostAbsolute, "submodule", "status")).not.toThrow();
			}),
	);

	it.effect(
		"fixes a stale core.worktree in config.worktree when extensions.worktreeConfig is set -- the #377 arrangement `git mv` itself never touches",
		() =>
			Effect.gen(function* () {
				// `git mv` recomputes `core.worktree` in the module's MAIN config
				// (pinned by the Task 11 probe) but never touches `config.worktree`
				// (the `extensions.worktreeConfig` per-worktree file) at all -- and
				// once `extensions.worktreeConfig` is set, `config.worktree`'s
				// `core.worktree` OVERRIDES the main config's, so a stale value there
				// breaks every git operation against the submodule even though the
				// main config is already correct. This is #377's actual arrangement.
				const up = makeUpstream();
				const host = makeHost();
				const oldName = "spec";
				const newName = "spec-renamed";
				const upstreamUrl = `file://${up}`;

				const managerLayer = makeManagerLayer();
				const run = <A, E>(effect: Effect.Effect<A, E, ReposManager>) =>
					effect.pipe(Effect.provide(managerLayer)) as Effect.Effect<A, E>;

				yield* run(
					Effect.gen(function* () {
						const manager = yield* ReposManager;
						return yield* manager.add(host, {
							url: upstreamUrl,
							ref: "1.0.0",
							purpose: "spec authority",
							name: oldName,
						});
					}),
				);
				git(host, "commit", "--quiet", "-m", "add spec submodule");

				const moduleDir = join(host, ".git", "modules", ".repos", oldName);
				// `add` already locked the tree (ReposLockdown) by the time this
				// runs, so the fixture setup below -- reaching in by hand, outside
				// any `ReposManager` method -- needs the module dir briefly
				// writable, the same way the lockdown-specific tests in this file
				// do. `rename` unlocks/relocks the tree itself regardless of the
				// state this leaves it in, so no explicit re-lock is needed here.
				chmodSync(moduleDir, 0o755);
				chmodSync(join(moduleDir, "config"), 0o644);

				// Seed the #377 arrangement: enable the per-worktree config
				// extension and give it a `core.worktree` that names the CURRENT
				// (pre-rename) worktree -- realistic, not garbage, and still
				// guaranteed to go stale the instant `mv` physically relocates that
				// directory out from under it.
				git(moduleDir, "config", "extensions.worktreeConfig", "true");
				const preRenameWorktree = join(host, ".repos", oldName);
				git(moduleDir, "config", "-f", join(moduleDir, "config.worktree"), "core.worktree", preRenameWorktree);
				expect(readFileSync(join(moduleDir, "config.worktree"), "utf8")).toContain(preRenameWorktree);

				const renameResult: ReposRenameResult = yield* run(
					Effect.gen(function* () {
						const manager = yield* ReposManager;
						return yield* manager.rename(host, oldName, newName);
					}),
				);
				expect(renameResult.newName).toBe(newName);

				// `config.worktree`'s `core.worktree` now points at the NEW path, in
				// the same GITDIR-relative form the main config gets -- proves
				// `configSet` (routed through `root`, per the fix below) CAN target
				// this file; no raw-fs `GitConfig` fallback was needed.
				const configWorktreeAfter = readFileSync(join(moduleDir, "config.worktree"), "utf8");
				const newWorktree = join(host, ".repos", newName);
				const expectedWorktreeValue = relative(moduleDir, newWorktree);
				expect(configWorktreeAfter).toContain(`worktree = ${expectedWorktreeValue}`);
				expect(configWorktreeAfter).not.toContain(`worktree = ${preRenameWorktree}\n`);

				// The #377 failure mode itself: without the fix, a plain git
				// invocation against the submodule's own worktree fails outright
				// ("cannot chdir to '<stale value>'") because `config.worktree`'s
				// value overrides the (already-correct) main config and no longer
				// resolves to anything on disk. Both a plain worktree-local status
				// AND the host's submodule-status view must succeed post-rename.
				expect(() => git(newWorktree, "status", "--porcelain")).not.toThrow();
				expect(() => git(host, "submodule", "status")).not.toThrow();

				// Fix round 3: the SUPERPROJECT's own `.git/config` registration
				// must also follow the rename, or `git submodule status` reads a
				// perfectly healthy, checked-out submodule as UNINITIALIZED
				// (`-` prefix) -- a live-repo post-rename finding, independent of
				// the `config.worktree` fix above (this fixture exercises both in
				// the same run since both were seeded together on the live repo).
				const submoduleStatusLine = git(host, "submodule", "status").trimEnd();
				expect(submoduleStatusLine.startsWith("-")).toBe(false);
				expect(submoduleStatusLine.startsWith("+")).toBe(false);
				expect(submoduleStatusLine).toContain(`.repos/${newName}`);
				const gitConfigRegistrations = git(host, "config", "--get-regexp", "submodule\\..*").trim();
				expect(gitConfigRegistrations).toContain(`submodule..repos/${newName}.url`);
				expect(gitConfigRegistrations).not.toContain(`submodule..repos/${oldName}.url`);
			}),
	);

	it.effect(
		"finds and renames a .gitmodules section registered under a name that diverges from the manifest key, pairing by path",
		() =>
			Effect.gen(function* () {
				// The re-slugged-after-vendoring shape: the manifest key
				// ("effect") differs from the .gitmodules section name
				// ("legacy-name"). `git mv` itself pairs by `path`, not `name` (the
				// Task 11 probe's finding 1), and the manager's own section lookup
				// mirrors that -- this test proves it end to end without a real
				// `git mv` spawn, since the point under test is the PAIRING logic,
				// not git's own mv mechanics (already pinned by the probe above).
				const root = mkdtempSync(join(tmpdir(), "repos-manager-rename-divergent-"));
				git(root, "init", "--quiet", "-b", "main");
				git(root, "config", "commit.gpgsign", "false");
				const oldName = "effect";
				const newName = "effect2";
				const oldRepoDir = join(root, ".repos", oldName);
				const newRepoDir = join(root, ".repos", newName);
				const moduleDirActual = join(root, ".git", "modules", ".repos", "legacy-name");

				mkdirSync(oldRepoDir, { recursive: true });
				writeFileSync(join(oldRepoDir, "marker.txt"), "worktree\n");
				mkdirSync(moduleDirActual, { recursive: true });
				writeFileSync(join(moduleDirActual, "marker.txt"), "gitdir\n");
				writeFileSync(join(oldRepoDir, ".git"), `gitdir: ${moduleDirActual}\n`);
				const gitmodulesPath = join(root, ".gitmodules");
				writeFileSync(
					gitmodulesPath,
					`[submodule "legacy-name"]\n\tpath = .repos/${oldName}\n\turl = https://example.com/effect.git\n`,
				);
				writeFileSync(join(root, ".repos", "config.json"), `${JSON.stringify({ repos: {} }, null, "\t")}\n`);
				git(root, "add", "-A");
				git(root, "commit", "--quiet", "-m", "seed divergent fixture");

				const manifest: ReposManifestFile = {
					repos: { [oldName]: { url: "https://example.com/effect.git", ref: "1.0.0", purpose: "vendored source" } },
				};
				const configStoreStub = Layer.succeed(ReposConfigStore, {
					exists: () => Effect.succeed(true),
					read: () => Effect.succeed(manifest),
					write: () => Effect.succeed(undefined),
					update: (_root: string, fn: (m: ReposManifestFile) => ReposManifestFile) => Effect.succeed(fn(manifest)),
				} as never);

				// `mv` is stubbed to simulate exactly what the Task 11 probe pinned
				// real git as doing: move the worktree dir and rewrite (only) the
				// `.gitmodules` `path` field for the section that already had the
				// old path -- leaving the section NAME untouched, which is exactly
				// the divergence this test exercises `rename`'s own canonicalization
				// against.
				const submoduleInitCalls: Array<ReadonlyArray<string> | undefined> = [];
				const gitStub = Git.layerTest({
					mv: () =>
						Effect.sync(() => {
							renameSync(oldRepoDir, newRepoDir);
							const before = readFileSync(gitmodulesPath, "utf8");
							writeFileSync(gitmodulesPath, before.replace(`path = .repos/${oldName}`, `path = .repos/${newName}`));
						}),
					configSet: () => Effect.succeed(undefined),
					add: () => Effect.succeed(undefined),
					submoduleStatus: () => Effect.succeed([]),
					submoduleInit: (_cwd, options) => {
						submoduleInitCalls.push(options?.paths);
						return Effect.succeed(undefined);
					},
					// Simulates "never set" for both keys -- the tolerant, non-error
					// path `unsetIfPresent` exists for: an old registration that was
					// itself never initialized must not fail `rename`. `configUnset`
					// is deliberately left UNSTUBBED: `unsetIfPresent` must never call
					// it when `configGet` reports absence, and `Git.makeTest` dies
					// loudly on any unstubbed method actually invoked, so this test
					// fails hard if that guard ever regresses.
					configGet: () => Effect.succeed(Option.none()),
				});

				const managerLayer = ReposManager.layer.pipe(
					Layer.provide(configStoreStub),
					Layer.provide(gitStub),
					Layer.provide(reposLockdownLayer),
					Layer.provide(NodeServices.layer),
				);

				const renameResult: ReposRenameResult = yield* Effect.gen(function* () {
					const manager = yield* ReposManager;
					return yield* manager.rename(root, oldName, newName);
				}).pipe(Effect.provide(managerLayer)) as Effect.Effect<ReposRenameResult>;

				expect(renameResult.oldName).toBe(oldName);
				expect(renameResult.newName).toBe(newName);
				expect(renameResult.path).toBe(`.repos/${newName}`);

				const gitmodulesAfter = readFileSync(gitmodulesPath, "utf8");
				expect(gitmodulesAfter).not.toContain("legacy-name");
				expect(gitmodulesAfter).toContain(`[submodule ".repos/${newName}"]`);
				expect(gitmodulesAfter).toContain(`path = .repos/${newName}`);

				// `.git/config` registration follows the rename too: `submoduleInit`
				// runs against the (now canonical) new path, re-registering under
				// the NEW section name so `git submodule status` reads it as
				// initialized instead of the divergently-registered old name.
				expect(submoduleInitCalls).toEqual([[`.repos/${newName}`]]);
			}),
	);

	it.effect(
		"fails typed (ReposConfigError, kind invalid) when a concurrent manifest mutation removes oldName between the existence check and the update write, instead of silently reporting success",
		() =>
			Effect.gen(function* () {
				// Reproduces the narrow race the manifest-write's own lock cannot
				// close: `rename`'s up-front `configStore.read` sees `oldName`
				// present, git gets fully renamed, and only THEN does the raced
				// `update` callback observe a manifest where `oldName` is already
				// gone (e.g. a concurrent `remove` won the lock first). Before this
				// fix, `update`'s callback returned `fresh` unchanged and `rename`
				// reported success anyway; now it fails typed instead.
				const root = mkdtempSync(join(tmpdir(), "repos-manager-rename-race-"));
				git(root, "init", "--quiet", "-b", "main");
				git(root, "config", "commit.gpgsign", "false");
				const oldName = "spec";
				const newName = "spec2";
				const oldRepoDir = join(root, ".repos", oldName);
				const newRepoDir = join(root, ".repos", newName);
				const moduleDirActual = join(root, ".git", "modules", ".repos", oldName);

				mkdirSync(oldRepoDir, { recursive: true });
				writeFileSync(join(oldRepoDir, "marker.txt"), "worktree\n");
				mkdirSync(moduleDirActual, { recursive: true });
				writeFileSync(join(moduleDirActual, "marker.txt"), "gitdir\n");
				writeFileSync(join(oldRepoDir, ".git"), `gitdir: ${moduleDirActual}\n`);
				const gitmodulesPath = join(root, ".gitmodules");
				writeFileSync(
					gitmodulesPath,
					`[submodule ".repos/${oldName}"]\n\tpath = .repos/${oldName}\n\turl = https://example.com/spec.git\n`,
				);
				writeFileSync(join(root, ".repos", "config.json"), `${JSON.stringify({ repos: {} }, null, "\t")}\n`);
				git(root, "add", "-A");
				git(root, "commit", "--quiet", "-m", "seed race fixture");

				const existenceManifest: ReposManifestFile = {
					repos: { [oldName]: { url: "https://example.com/spec.git", ref: "1.0.0", purpose: "vendored source" } },
				};
				// The RACED manifest `update`'s callback actually observes -- oldName
				// already gone, simulating a concurrent remove/rename that landed
				// first.
				const racedManifest: ReposManifestFile = { repos: {} };

				let updateCalled = false;
				const configStoreStub = Layer.succeed(ReposConfigStore, {
					exists: () => Effect.succeed(true),
					read: () => Effect.succeed(existenceManifest),
					write: () => Effect.succeed(undefined),
					update: (
						_root: string,
						fn: (m: ReposManifestFile) => ReposManifestFile | Effect.Effect<ReposManifestFile>,
					) => {
						updateCalled = true;
						const result = fn(racedManifest);
						return Effect.isEffect(result) ? result : Effect.succeed(result);
					},
				} as never);

				const gitStub = Git.layerTest({
					mv: () =>
						Effect.sync(() => {
							renameSync(oldRepoDir, newRepoDir);
							const before = readFileSync(gitmodulesPath, "utf8");
							writeFileSync(gitmodulesPath, before.split(`.repos/${oldName}`).join(`.repos/${newName}`));
						}),
					configSet: () => Effect.succeed(undefined),
					add: () => Effect.succeed(undefined),
					submoduleStatus: () => Effect.succeed([]),
					submoduleInit: () => Effect.succeed(undefined),
					configGet: () => Effect.succeed(Option.none()),
				});

				const managerLayer = ReposManager.layer.pipe(
					Layer.provide(configStoreStub),
					Layer.provide(gitStub),
					Layer.provide(reposLockdownLayer),
					Layer.provide(NodeServices.layer),
				);

				const exit = yield* Effect.exit(
					Effect.gen(function* () {
						const manager = yield* ReposManager;
						return yield* manager.rename(root, oldName, newName);
					}).pipe(Effect.provide(managerLayer)) as Effect.Effect<unknown, unknown>,
				);

				// Git already fully renamed -- the failure surfaces from the
				// manifest-write step, not from any earlier step being skipped.
				expect(existsSync(newRepoDir)).toBe(true);
				expect(updateCalled).toBe(true);

				expect(exit._tag).toBe("Failure");
				if (exit._tag === "Failure") {
					expect(Option.getOrThrow(Cause.findErrorOption(exit.cause))).toMatchObject({
						_tag: "ReposConfigError",
						kind: "invalid",
					});
				}
			}),
	);

	it.effect(
		"fails with RepoNotFoundError for an old name absent from the manifest, touching neither git nor the filesystem",
		() =>
			Effect.gen(function* () {
				const configStoreStub = Layer.succeed(ReposConfigStore, {
					exists: () => Effect.succeed(true),
					read: () => Effect.succeed({ repos: {} } as ReposManifestFile),
					write: () => Effect.succeed(undefined),
				} as never);

				const root = mkdtempSync(join(tmpdir(), "repos-manager-rename-missing-"));
				const gitStub = Layer.succeed(Git, {} as never);

				const exit = yield* Effect.exit(
					Effect.gen(function* () {
						const manager = yield* ReposManager;
						return yield* manager.rename(root, "does-not-exist", "new-name");
					}).pipe(
						Effect.provide(ReposManager.layer),
						Effect.provide(configStoreStub),
						Effect.provide(gitStub),
						Effect.provide(reposLockdownLayer),
						Effect.provide(NodeServices.layer),
					) as Effect.Effect<unknown, unknown>,
				);

				expect(exit._tag).toBe("Failure");
				if (exit._tag === "Failure") {
					expect(Option.getOrThrow(Cause.findErrorOption(exit.cause))).toMatchObject({
						_tag: "RepoNotFoundError",
						name: "does-not-exist",
					});
				}
			}),
	);

	it.effect(
		"fails with a typed conflict when newName is already vendored, touching neither git nor the filesystem",
		() =>
			Effect.gen(function* () {
				const manifest: ReposManifestFile = {
					repos: {
						foo: { url: "https://example.com/foo.git", ref: "1.0.0", purpose: "vendor foo" },
						bar: { url: "https://example.com/bar.git", ref: "1.0.0", purpose: "vendor bar" },
					},
				};
				const configStoreStub = Layer.succeed(ReposConfigStore, {
					exists: () => Effect.succeed(true),
					read: () => Effect.succeed(manifest),
					write: () => Effect.succeed(undefined),
				} as never);

				const root = mkdtempSync(join(tmpdir(), "repos-manager-rename-conflict-"));
				const gitStub = Layer.succeed(Git, {} as never);

				const exit = yield* Effect.exit(
					Effect.gen(function* () {
						const manager = yield* ReposManager;
						return yield* manager.rename(root, "foo", "bar");
					}).pipe(
						Effect.provide(ReposManager.layer),
						Effect.provide(configStoreStub),
						Effect.provide(gitStub),
						Effect.provide(reposLockdownLayer),
						Effect.provide(NodeServices.layer),
					) as Effect.Effect<unknown, unknown>,
				);

				expect(exit._tag).toBe("Failure");
				if (exit._tag === "Failure") {
					expect(Option.getOrThrow(Cause.findErrorOption(exit.cause))).toMatchObject({
						_tag: "ReposConfigError",
						kind: "invalid",
					});
				}
			}),
	);

	it.effect("fails with a typed validation error for an invalid newName, touching neither git nor the filesystem", () =>
		Effect.gen(function* () {
			const manifest: ReposManifestFile = {
				repos: { foo: { url: "https://example.com/foo.git", ref: "1.0.0", purpose: "vendor foo" } },
			};
			const configStoreStub = Layer.succeed(ReposConfigStore, {
				exists: () => Effect.succeed(true),
				read: () => Effect.succeed(manifest),
				write: () => Effect.succeed(undefined),
			} as never);

			const root = mkdtempSync(join(tmpdir(), "repos-manager-rename-invalid-name-"));
			const gitStub = Layer.succeed(Git, {} as never);

			const exit = yield* Effect.exit(
				Effect.gen(function* () {
					const manager = yield* ReposManager;
					return yield* manager.rename(root, "foo", "../escape");
				}).pipe(
					Effect.provide(ReposManager.layer),
					Effect.provide(configStoreStub),
					Effect.provide(gitStub),
					Effect.provide(reposLockdownLayer),
					Effect.provide(NodeServices.layer),
				) as Effect.Effect<unknown, unknown>,
			);

			expect(exit._tag).toBe("Failure");
			if (exit._tag === "Failure") {
				expect(Option.getOrThrow(Cause.findErrorOption(exit.cause))).toMatchObject({
					_tag: "ReposConfigError",
					kind: "invalid",
				});
			}
		}),
	);
});

describe("ReposManager.restore — real git", REAL_GIT_TIMEOUT, () => {
	let previousAllowProtocol: string | undefined;

	beforeAll(() => {
		previousAllowProtocol = process.env.GIT_ALLOW_PROTOCOL;
		process.env.GIT_ALLOW_PROTOCOL = "file";
	});

	afterAll(() => {
		if (previousAllowProtocol === undefined) {
			delete process.env.GIT_ALLOW_PROTOCOL;
		} else {
			process.env.GIT_ALLOW_PROTOCOL = previousAllowProtocol;
		}
	});

	function makeUpstream(): string {
		const up = mkdtempSync(join(tmpdir(), "repos-manager-restore-upstream-"));
		git(up, "init", "--quiet", "-b", "main");
		git(up, "config", "commit.gpgsign", "false");
		mkdirSync(join(up, "src"), { recursive: true });
		mkdirSync(join(up, "docs"), { recursive: true });
		writeFileSync(join(up, "src", "keep.ts"), "export const keep = true;\n");
		writeFileSync(join(up, "docs", "skip.md"), "# skip\n");
		git(up, "add", "-A");
		git(up, "commit", "--quiet", "-m", "initial");
		git(up, "tag", "1.0.0");
		return up;
	}

	function makeHost(): string {
		const host = mkdtempSync(join(tmpdir(), "repos-manager-restore-host-"));
		git(host, "init", "--quiet", "-b", "main");
		execFileSync("git", ["config", "protocol.file.allow", "always"], { cwd: host });
		git(host, "config", "commit.gpgsign", "false");
		writeFileSync(join(host, "README.md"), "# host\n");
		git(host, "add", "-A");
		git(host, "commit", "--quiet", "-m", "initial");
		return host;
	}

	function makeManagerLayer() {
		const configStoreLayer = ReposConfigStore.layer.pipe(Layer.provide(NodeServices.layer));
		return ReposManager.layer.pipe(
			Layer.provide(configStoreLayer),
			Layer.provide(Git.layer.pipe(Layer.provide(NodeServices.layer))),
			Layer.provide(reposLockdownLayer),
			Layer.provide(NodeServices.layer),
		);
	}

	/** Recursively `chmod u+w` a lockdown-locked tree so the test can dirty it by hand -- mirroring an agent bypassing the guard, the exact scenario `restore` exists to recover from. */
	function makeWritable(dir: string): void {
		let entries: Array<{ name: string; isDirectory(): boolean }>;
		try {
			entries = readdirSync(dir, { withFileTypes: true });
		} catch {
			return;
		}
		for (const entry of entries) {
			const entryPath = join(dir, entry.name);
			if (entry.isDirectory()) {
				chmodSync(entryPath, statSync(entryPath).mode | 0o700);
				makeWritable(entryPath);
			} else {
				chmodSync(entryPath, statSync(entryPath).mode | 0o200);
			}
		}
		chmodSync(dir, statSync(dir).mode | 0o700);
	}

	/** Recursion helper for {@link firstFileUnder}. */
	function findFileUnder(dir: string): string | undefined {
		for (const entry of readdirSync(dir, { withFileTypes: true })) {
			const entryPath = join(dir, entry.name);
			if (entry.isDirectory()) {
				const found = findFileUnder(entryPath);
				if (found !== undefined) {
					return found;
				}
			} else {
				return entryPath;
			}
		}
		return undefined;
	}

	/** Walk `dir` for the first regular file found, so a lock-mode assertion has a concrete target. */
	function firstFileUnder(dir: string): string {
		const found = findFileUnder(dir);
		if (found === undefined) {
			throw new Error(`no file found under ${dir}`);
		}
		return found;
	}

	it.effect(
		"hard-resets a dirty checkout (tracked edit + untracked file) back to the pinned commit, discards the untracked file, re-applies sparse, and ends locked",
		() =>
			Effect.gen(function* () {
				const up = makeUpstream();
				const host = makeHost();
				const name = "spec";
				const upstreamUrl = `file://${up}`;

				const managerLayer = makeManagerLayer();
				const run = <A, E>(effect: Effect.Effect<A, E, ReposManager>) =>
					effect.pipe(Effect.provide(managerLayer)) as Effect.Effect<A, E>;

				yield* run(
					Effect.gen(function* () {
						const manager = yield* ReposManager;
						return yield* manager.add(host, {
							url: upstreamUrl,
							ref: "1.0.0",
							purpose: "spec authority",
							name,
							sparse: ["src"],
						});
					}),
				);
				git(host, "commit", "--quiet", "-m", "add spec submodule");

				const subPath = join(host, ".repos", name);
				const pinnedCommit = git(subPath, "rev-parse", "HEAD").trim();

				// Ends locked after `add` -- dirty it by hand (the guard-bypass
				// scenario `restore` exists to recover from), then leave it
				// however the OS finds it: `restore` itself must relock.
				makeWritable(subPath);
				writeFileSync(join(subPath, "src", "keep.ts"), "export const keep = false; // dirtied\n");
				writeFileSync(join(subPath, "untracked.txt"), "should be discarded\n");

				const restoreResult: ReposRestoreResult = yield* run(
					Effect.gen(function* () {
						const manager = yield* ReposManager;
						return yield* manager.restore(host, [name]);
					}),
				);

				expect(restoreResult).toEqual({ restored: [{ name, commit: pinnedCommit }], skippedClean: [], stillDirty: [] });

				expect(git(subPath, "rev-parse", "HEAD").trim()).toBe(pinnedCommit);
				expect(readFileSync(join(subPath, "src", "keep.ts"), "utf8")).toBe("export const keep = true;\n");
				expect(existsSync(join(subPath, "untracked.txt"))).toBe(false);

				// Sparse re-applied: only `src` materialized, `docs` absent.
				expect(existsSync(join(subPath, "docs"))).toBe(false);
				expect(readdirSync(join(subPath, "src"))).toContain("keep.ts");

				// Ends locked.
				expect(statSync(firstFileUnder(subPath)).mode & 0o777).toBe(0o444);
			}),
	);

	it.effect("names-omitted form restores only dirty entries and reports the clean ones as skipped", () =>
		Effect.gen(function* () {
			const up = makeUpstream();
			const host = makeHost();
			const dirtyName = "dirty-spec";
			const cleanName = "clean-spec";
			const upstreamUrl = `file://${up}`;

			const managerLayer = makeManagerLayer();
			const run = <A, E>(effect: Effect.Effect<A, E, ReposManager>) =>
				effect.pipe(Effect.provide(managerLayer)) as Effect.Effect<A, E>;

			yield* run(
				Effect.gen(function* () {
					const manager = yield* ReposManager;
					yield* manager.add(host, { url: upstreamUrl, ref: "1.0.0", purpose: "spec authority", name: dirtyName });
					yield* manager.add(host, { url: upstreamUrl, ref: "1.0.0", purpose: "spec authority", name: cleanName });
				}),
			);
			git(host, "commit", "--quiet", "-m", "add both submodules");

			const dirtySubPath = join(host, ".repos", dirtyName);
			const pinnedCommit = git(dirtySubPath, "rev-parse", "HEAD").trim();

			makeWritable(dirtySubPath);
			writeFileSync(join(dirtySubPath, "untracked.txt"), "should be discarded\n");

			const restoreResult: ReposRestoreResult = yield* run(
				Effect.gen(function* () {
					const manager = yield* ReposManager;
					return yield* manager.restore(host);
				}),
			);

			expect(restoreResult.restored).toEqual([{ name: dirtyName, commit: pinnedCommit }]);
			expect(restoreResult.skippedClean).toEqual([cleanName]);
			expect(existsSync(join(dirtySubPath, "untracked.txt"))).toBe(false);
		}),
	);

	it.effect("restores to the STAGED gitlink commit, not HEAD's, when a pin was staged but never committed", () =>
		Effect.gen(function* () {
			const up = makeUpstream();
			const host = makeHost();
			const name = "spec";
			const upstreamUrl = `file://${up}`;

			const managerLayer = makeManagerLayer();
			const run = <A, E>(effect: Effect.Effect<A, E, ReposManager>) =>
				effect.pipe(Effect.provide(managerLayer)) as Effect.Effect<A, E>;

			yield* run(
				Effect.gen(function* () {
					const manager = yield* ReposManager;
					return yield* manager.add(host, { url: upstreamUrl, ref: "1.0.0", purpose: "spec authority", name });
				}),
			);
			git(host, "commit", "--quiet", "-m", "add spec submodule");

			// Cut a second tag upstream and pin to it WITHOUT committing the
			// host repo -- the new gitlink sits staged in the index while
			// HEAD's committed gitlink still names the first commit.
			writeFileSync(join(up, "src", "second.ts"), "export const second = true;\n");
			git(up, "add", "-A");
			git(up, "commit", "--quiet", "-m", "second");
			git(up, "tag", "2.0.0");

			const pinResult: ReposPinResult = yield* run(
				Effect.gen(function* () {
					const manager = yield* ReposManager;
					return yield* manager.pin(host, name, "2.0.0");
				}),
			);
			const stagedCommit = pinResult.newCommit;

			const subPath = join(host, ".repos", name);
			expect(git(subPath, "rev-parse", "HEAD").trim()).toBe(stagedCommit);

			makeWritable(subPath);
			writeFileSync(join(subPath, "untracked.txt"), "should be discarded\n");

			const restoreResult: ReposRestoreResult = yield* run(
				Effect.gen(function* () {
					const manager = yield* ReposManager;
					return yield* manager.restore(host, [name]);
				}),
			);

			expect(restoreResult.restored).toEqual([{ name, commit: stagedCommit }]);
			expect(git(subPath, "rev-parse", "HEAD").trim()).toBe(stagedCommit);
		}),
	);

	it.effect(
		"restores an explicitly named repo that is porcelain-clean but checked out away from the pinned commit",
		() =>
			Effect.gen(function* () {
				const up = makeUpstream();
				const host = makeHost();
				const name = "spec";
				const upstreamUrl = `file://${up}`;

				const managerLayer = makeManagerLayer();
				const run = <A, E>(effect: Effect.Effect<A, E, ReposManager>) =>
					effect.pipe(Effect.provide(managerLayer)) as Effect.Effect<A, E>;

				yield* run(
					Effect.gen(function* () {
						const manager = yield* ReposManager;
						return yield* manager.add(host, { url: upstreamUrl, ref: "1.0.0", purpose: "spec authority", name });
					}),
				);
				git(host, "commit", "--quiet", "-m", "add spec submodule");

				const subPath = join(host, ".repos", name);
				const moduleDir = join(host, ".git", "modules", ".repos", name);
				const pinnedCommit = git(subPath, "rev-parse", "HEAD").trim();

				// Cut a second upstream commit and detach the submodule's own
				// checkout onto it BY HAND -- no file edits relative to that new
				// commit, so `git status --porcelain` inside the submodule reports
				// empty (genuinely clean by the `dirty` predicate `status` uses)
				// even though HEAD no longer matches the pinned gitlink commit.
				// This is the arrangement that discriminates "an explicit name
				// still restores when clean" from "explicit names are filtered
				// like the names-omitted form": a dirty-skip regression in the
				// explicit branch would leave HEAD at `driftedCommit` here, while
				// the honored contract must move it back to `pinnedCommit`.
				writeFileSync(join(up, "src", "second.ts"), "export const second = true;\n");
				git(up, "add", "-A");
				git(up, "commit", "--quiet", "-m", "second");
				git(up, "tag", "2.0.0");

				makeWritable(subPath);
				makeWritable(moduleDir);
				git(subPath, "fetch", "--quiet", "origin", "2.0.0");
				git(subPath, "checkout", "--quiet", "--detach", "FETCH_HEAD");
				const driftedCommit = git(subPath, "rev-parse", "HEAD").trim();
				expect(driftedCommit).not.toBe(pinnedCommit);
				expect(git(subPath, "status", "--porcelain").trim()).toBe("");

				const restoreResult: ReposRestoreResult = yield* run(
					Effect.gen(function* () {
						const manager = yield* ReposManager;
						return yield* manager.restore(host, [name]);
					}),
				);

				expect(restoreResult).toEqual({ restored: [{ name, commit: pinnedCommit }], skippedClean: [], stillDirty: [] });
				expect(git(subPath, "rev-parse", "HEAD").trim()).toBe(pinnedCommit);
			}),
	);

	it.effect(
		"fails with RepoNotFoundError for a name absent from the manifest, touching neither git nor the filesystem",
		() =>
			Effect.gen(function* () {
				const configStoreStub = Layer.succeed(ReposConfigStore, {
					exists: () => Effect.succeed(true),
					read: () => Effect.succeed({ repos: {} } as ReposManifestFile),
					write: () => Effect.succeed(undefined),
				} as never);

				const root = mkdtempSync(join(tmpdir(), "repos-manager-restore-missing-"));
				const gitStub = Layer.succeed(Git, {} as never);

				const exit = yield* Effect.exit(
					Effect.gen(function* () {
						const manager = yield* ReposManager;
						return yield* manager.restore(root, ["does-not-exist"]);
					}).pipe(
						Effect.provide(ReposManager.layer),
						Effect.provide(configStoreStub),
						Effect.provide(gitStub),
						Effect.provide(reposLockdownLayer),
						Effect.provide(NodeServices.layer),
					) as Effect.Effect<unknown, unknown>,
				);

				expect(exit._tag).toBe("Failure");
				if (exit._tag === "Failure") {
					expect(Option.getOrThrow(Cause.findErrorOption(exit.cause))).toMatchObject({
						_tag: "RepoNotFoundError",
						name: "does-not-exist",
					});
				}
			}),
	);

	it.effect(
		'fails with RepoNotFoundError for the name "constructor", never resolving the inherited Object.prototype member, touching no git',
		() =>
			Effect.gen(function* () {
				const configStoreStub = Layer.succeed(ReposConfigStore, {
					exists: () => Effect.succeed(true),
					read: () => Effect.succeed({ repos: {} } as ReposManifestFile),
					write: () => Effect.succeed(undefined),
				} as never);

				const root = mkdtempSync(join(tmpdir(), "repos-manager-restore-proto-"));
				const gitStub = Layer.succeed(Git, {} as never);

				const exit = yield* Effect.exit(
					Effect.gen(function* () {
						const manager = yield* ReposManager;
						return yield* manager.restore(root, ["constructor"]);
					}).pipe(
						Effect.provide(ReposManager.layer),
						Effect.provide(configStoreStub),
						Effect.provide(gitStub),
						Effect.provide(reposLockdownLayer),
						Effect.provide(NodeServices.layer),
					) as Effect.Effect<unknown, unknown>,
				);

				expect(exit._tag).toBe("Failure");
				if (exit._tag === "Failure") {
					expect(Option.getOrThrow(Cause.findErrorOption(exit.cause))).toMatchObject({
						_tag: "RepoNotFoundError",
						name: "constructor",
					});
				}
			}),
	);
});

describe("ReposManager.deregister — real git", REAL_GIT_TIMEOUT, () => {
	function makeHost(): string {
		const host = mkdtempSync(join(tmpdir(), "repos-manager-deregister-"));
		git(host, "init", "--quiet", "-b", "main");
		git(host, "config", "commit.gpgsign", "false");
		writeFileSync(join(host, "README.md"), "# host\n");
		git(host, "add", "-A");
		git(host, "commit", "--quiet", "-m", "initial");
		return host;
	}

	function makeManagerLayer(readManifest: Effect.Effect<ReposManifestFile, ReposConfigError>) {
		const configStore = Layer.succeed(ReposConfigStore, {
			exists: () => Effect.succeed(true),
			read: () => readManifest,
			write: () => Effect.succeed(undefined),
		} as never);
		return ReposManager.layer.pipe(
			Layer.provide(configStore),
			Layer.provide(Git.layer.pipe(Layer.provide(NodeServices.layer))),
			Layer.provide(reposLockdownLayer),
			Layer.provide(NodeServices.layer),
		);
	}

	it.effect("removes a stale submodule section and reports the keys it carried", () =>
		Effect.gen(function* () {
			const host = makeHost();
			// A stale registration: a `submodule..repos/old.*` section in the
			// LOCAL config that no manifest entry backs — the state a rename or
			// an unvendoring leaves behind.
			git(host, "config", "submodule..repos/old.url", "https://example.com/old.git");
			git(host, "config", "submodule..repos/old.active", "true");

			const managerLayer = makeManagerLayer(Effect.succeed({ repos: {} } as ReposManifestFile));
			const result = yield* Effect.gen(function* () {
				const manager = yield* ReposManager;
				return yield* manager.deregister(host, ".repos/old");
			}).pipe(Effect.provide(managerLayer)) as Effect.Effect<ReposDeregisterResult>;

			expect(result.section).toBe(".repos/old");
			expect(result.removedKeys).toEqual(
				expect.arrayContaining(["submodule..repos/old.url", "submodule..repos/old.active"]),
			);
			// The section is really gone from the local config.
			expect(() => git(host, "config", "--get", "submodule..repos/old.url")).toThrow();
		}),
	);

	it.effect("treats a MISSING manifest as empty — a stale registration can outlive the manifest itself", () =>
		Effect.gen(function* () {
			const host = makeHost();
			git(host, "config", "submodule..repos/old.url", "https://example.com/old.git");

			const managerLayer = makeManagerLayer(
				Effect.fail(
					new ReposConfigError({ path: join(host, ".repos", "config.json"), reason: "no such file", kind: "missing" }),
				),
			);
			const result = yield* Effect.gen(function* () {
				const manager = yield* ReposManager;
				return yield* manager.deregister(host, ".repos/old");
			}).pipe(Effect.provide(managerLayer)) as Effect.Effect<ReposDeregisterResult>;

			expect(result.section).toBe(".repos/old");
			expect(() => git(host, "config", "--get", "submodule..repos/old.url")).toThrow();
		}),
	);

	it.effect("refuses to deregister the canonical registration of a live manifest entry", () =>
		Effect.gen(function* () {
			const host = makeHost();
			// The LIVE registration a healthy vendored checkout carries — must
			// survive: clearing it is sync's/remove's job, never deregister's.
			git(host, "config", "submodule..repos/spec.url", "https://example.com/spec.git");

			const managerLayer = makeManagerLayer(
				Effect.succeed({
					repos: { spec: { url: "https://example.com/spec.git", ref: "1.0.0", purpose: "spec authority" } },
				} as ReposManifestFile),
			);
			const error = yield* Effect.gen(function* () {
				const manager = yield* ReposManager;
				return yield* manager.deregister(host, ".repos/spec");
			}).pipe(Effect.provide(managerLayer), Effect.flip) as Effect.Effect<ReposConfigError | GitSubmoduleError>;

			expect(error).toMatchObject({ _tag: "ReposConfigError", kind: "invalid" });
			expect(String(error.message)).toContain("canonical registration");
			// The refusal happened BEFORE any git mutation: the section survives.
			expect(git(host, "config", "--get", "submodule..repos/spec.url").trim()).toBe("https://example.com/spec.git");
		}),
	);

	it.effect("fails typed, not with a loud git exit, when the section is not registered at all", () =>
		Effect.gen(function* () {
			const host = makeHost();

			const managerLayer = makeManagerLayer(Effect.succeed({ repos: {} } as ReposManifestFile));
			const error = yield* Effect.gen(function* () {
				const manager = yield* ReposManager;
				return yield* manager.deregister(host, ".repos/ghost");
			}).pipe(Effect.provide(managerLayer), Effect.flip) as Effect.Effect<ReposConfigError | GitSubmoduleError>;

			expect(error).toMatchObject({ _tag: "ReposConfigError", kind: "invalid" });
			expect(String(error.message)).toContain("nothing to deregister");
		}),
	);
});
