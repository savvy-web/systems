import { execFileSync } from "node:child_process";
import {
	existsSync,
	mkdirSync,
	mkdtempSync,
	readFileSync,
	readdirSync,
	rmSync,
	utimesSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { NodeServices } from "@effect/platform-node";
import { afterAll, beforeAll, describe, expect, it } from "@effect/vitest";
import { Git, GitCommandError } from "@effected/git";
import { Cause, Effect, Layer, Option } from "effect";
import type { ReposManifestFile } from "../../src/repos/schemas/manifest.js";
import type {
	ReposAddResult,
	ReposNoteResult,
	ReposPinResult,
	ReposStatusReport,
} from "../../src/repos/schemas/reports.js";
import { ReposConfigStore } from "../../src/repos/services/config-store.js";
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

			// A Git stub whose ls-tree lists nothing — the path isn't tracked at
			// HEAD, and the repo dir is absent so `status` is never consulted.
			const gitStub = Layer.succeed(Git, {
				lsTree: () => Effect.succeed([]),
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
				Effect.provide(NodeServices.layer),
			) as Effect.Effect<ReposStatusReport>;

			expect(report.repos).toHaveLength(1);
			const entry = report.repos[0];
			expect(entry?.name).toBe("spec");
			expect(entry?.present).toBe(false);
			expect(entry?.commit).toBeNull();
			expect(entry?.dirty).toBe(false);
			expect(entry?.staleNoteIds).toEqual(["stale-note"]);
			expect(report.clean).toBe(false);
		}),
	);
});

describe("ReposManager.sync / status — real git", () => {
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
				expect(cleanEntry?.commit).not.toBeNull();

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
});

describe("ReposManager.add / pin — real git", () => {
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

				// Manifest entry was written.
				const manifestPath = join(host, ".repos", "config.json");
				const manifestAfterAdd = JSON.parse(readFileSync(manifestPath, "utf8")) as ReposManifestFile;
				expect(manifestAfterAdd.repos[name]).toMatchObject({
					url: upstreamUrl,
					ref: "1.0.0",
					purpose: "spec authority",
					sparse: ["src"],
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

	it.effect("rejects an invalid --name before any side effect (path traversal)", () =>
		Effect.gen(function* () {
			const up = makeUpstream();
			const host = makeHost();
			const upstreamUrl = `file://${up}`;

			const configStoreLayer = ReposConfigStore.layer.pipe(Layer.provide(NodeServices.layer));
			const managerLayer = ReposManager.layer.pipe(
				Layer.provide(configStoreLayer),
				Layer.provide(Git.layer.pipe(Layer.provide(NodeServices.layer))),
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
			Effect.provide(NodeServices.layer),
		) as Effect.Effect<A, E>;
	}

	function runExit<A>(effect: Effect.Effect<A, unknown, ReposManager>, configStore: Layer.Layer<ReposConfigStore>) {
		return Effect.exit(
			effect.pipe(
				Effect.provide(ReposManager.layer),
				Effect.provide(configStore),
				Effect.provide(gitStub),
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
