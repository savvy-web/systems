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
import { CommandExecutor } from "@effect/platform";
import { NodeContext } from "@effect/platform-node";
import { Effect, Layer } from "effect";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { ReposManifestFile } from "../../src/repos/schemas/manifest.js";
import type {
	ReposAddResult,
	ReposNoteResult,
	ReposPinResult,
	ReposStatusReport,
} from "../../src/repos/schemas/reports.js";
import { ReposConfigStore, ReposConfigStoreLive } from "../../src/repos/services/config-store.js";
import { ReposManager, ReposManagerLive, STALE_LOCK_MAX_AGE_MS } from "../../src/repos/services/manager.js";

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
	it("reports absent/clean/stale shape from a canned manifest with no filesystem or git backing", async () => {
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

		const executorStub = Layer.succeed(CommandExecutor.CommandExecutor, {
			string: () => Effect.succeed(""),
		} as never);

		const root = mkdtempSync(join(tmpdir(), "repos-manager-status-"));

		const report: ReposStatusReport = await Effect.runPromise(
			Effect.gen(function* () {
				const manager = yield* ReposManager;
				return yield* manager.status(root);
			}).pipe(
				Effect.provide(ReposManagerLive),
				Effect.provide(configStoreStub),
				Effect.provide(executorStub),
				Effect.provide(NodeContext.layer),
			) as Effect.Effect<ReposStatusReport>,
		);

		expect(report.repos).toHaveLength(1);
		const entry = report.repos[0];
		expect(entry?.name).toBe("spec");
		expect(entry?.present).toBe(false);
		expect(entry?.commit).toBeNull();
		expect(entry?.dirty).toBe(false);
		expect(entry?.staleNoteIds).toEqual(["stale-note"]);
		expect(report.clean).toBe(false);
	});
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

	it("re-materializes a missing submodule, applies sparse-checkout, then reports up-to-date and clean on a second sync", async () => {
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

		const managerLayer = ReposManagerLive.pipe(Layer.provide(configStoreReal), Layer.provide(NodeContext.layer));
		const run = <A, E>(effect: Effect.Effect<A, E, ReposManager>) =>
			Effect.runPromise(effect.pipe(Effect.provide(managerLayer)) as Effect.Effect<A, E>);

		const firstSync = await run(
			Effect.gen(function* () {
				const manager = yield* ReposManager;
				return yield* manager.sync(host);
			}),
		);

		expect(firstSync.initialized).toEqual([name]);
		expect(firstSync.sparseApplied).toEqual([name]);
		expect(firstSync.upToDate).toEqual([]);

		const { readdirSync } = await import("node:fs");
		expect(readdirSync(join(host, ".repos", name, "src"))).toContain("keep.ts");
		expect(() => readdirSync(join(host, ".repos", name, "docs"))).toThrow();

		const secondSync = await run(
			Effect.gen(function* () {
				const manager = yield* ReposManager;
				return yield* manager.sync(host);
			}),
		);
		expect(secondSync.upToDate).toEqual([name]);
		expect(secondSync.initialized).toEqual([]);

		const statusClean = await run(
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

		const statusDirty = await run(
			Effect.gen(function* () {
				const manager = yield* ReposManager;
				return yield* manager.status(host);
			}),
		);
		const dirtyEntry = statusDirty.repos.find((r) => r.name === name);
		expect(dirtyEntry?.present).toBe(true);
		expect(dirtyEntry?.dirty).toBe(true);
	});

	it("clears stale lock files during sync and reports them in clearedLocks", async () => {
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

		const managerLayer = ReposManagerLive.pipe(Layer.provide(configStoreReal), Layer.provide(NodeContext.layer));
		const run = <A, E>(effect: Effect.Effect<A, E, ReposManager>) =>
			Effect.runPromise(effect.pipe(Effect.provide(managerLayer)) as Effect.Effect<A, E>);

		const syncResult = await run(
			Effect.gen(function* () {
				const manager = yield* ReposManager;
				return yield* manager.sync(host);
			}),
		);

		// Verify lock files were cleared
		expect(syncResult.clearedLocks).toContain(name);
		const { existsSync } = await import("node:fs");
		expect(existsSync(join(lockDirPath, "index.lock"))).toBe(false);
		expect(existsSync(join(lockDirPath, "shallow.lock"))).toBe(false);
	});

	it("leaves a young lock file in place and omits the repo from clearedLocks", async () => {
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

		const managerLayer = ReposManagerLive.pipe(Layer.provide(configStoreReal), Layer.provide(NodeContext.layer));
		const run = <A, E>(effect: Effect.Effect<A, E, ReposManager>) =>
			Effect.runPromiseExit(effect.pipe(Effect.provide(managerLayer)) as Effect.Effect<A, E>);

		const exit = await run(
			Effect.gen(function* () {
				const manager = yield* ReposManager;
				return yield* manager.sync(host);
			}),
		);

		// The young lock survives regardless of whether the subsequent git
		// operation itself succeeded or failed on the contested lock.
		const { existsSync } = await import("node:fs");
		expect(existsSync(join(lockDirPath, "index.lock"))).toBe(true);
		if (exit._tag === "Success") {
			expect(exit.value.clearedLocks).not.toContain(name);
		}
	});
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

	it("stages a new submodule + manifest entry on add, then re-pins it to a new tag without committing either time", async () => {
		const up = makeUpstream();
		const host = makeHost();
		const name = "spec";
		const upstreamUrl = `file://${up}`;

		const configStoreLayer = ReposConfigStoreLive.pipe(Layer.provide(NodeContext.layer));
		const managerLayer = ReposManagerLive.pipe(Layer.provide(configStoreLayer), Layer.provide(NodeContext.layer));
		const run = <A, E>(effect: Effect.Effect<A, E, ReposManager>) =>
			Effect.runPromise(effect.pipe(Effect.provide(managerLayer)) as Effect.Effect<A, E>);

		const commitCountBefore = git(host, "log", "--oneline").trim().split("\n").length;

		const addResult: ReposAddResult = await run(
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

		const pinResult: ReposPinResult = await run(
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
	});

	it("fails with RepoNotFoundError when pinning a name absent from the manifest", async () => {
		const configStoreStub = Layer.succeed(ReposConfigStore, {
			exists: () => Effect.succeed(true),
			read: () => Effect.succeed({ repos: {} } as ReposManifestFile),
			write: () => Effect.succeed(undefined),
		} as never);

		const root = mkdtempSync(join(tmpdir(), "repos-manager-pin-missing-"));

		const pinExit = await Effect.runPromiseExit(
			Effect.gen(function* () {
				const manager = yield* ReposManager;
				return yield* manager.pin(root, "does-not-exist", "1.0.0");
			}).pipe(
				Effect.provide(ReposManagerLive),
				Effect.provide(configStoreStub),
				Effect.provide(NodeContext.layer),
			) as Effect.Effect<unknown, unknown>,
		);

		expect(pinExit._tag).toBe("Failure");
		if (pinExit._tag === "Failure" && pinExit.cause._tag === "Fail") {
			expect(pinExit.cause.error).toMatchObject({ _tag: "RepoNotFoundError", name: "does-not-exist" });
		}
	});

	it("derives the default name slug from the upstream URL, stripping .git suffix", async () => {
		const up = makeUpstream();
		const host = makeHost();
		const upstreamBareDir = mkdtempSync(join(tmpdir(), "repos-manager-slug-upstream-"));
		execFileSync("git", ["clone", "--bare", up, join(upstreamBareDir, "myrepo.git")], {
			cwd: upstreamBareDir,
			env: { ...process.env, ...GIT_ENV },
		});
		const upstreamUrl = `file://${join(upstreamBareDir, "myrepo.git")}`;

		const configStoreLayer = ReposConfigStoreLive.pipe(Layer.provide(NodeContext.layer));
		const managerLayer = ReposManagerLive.pipe(Layer.provide(configStoreLayer), Layer.provide(NodeContext.layer));
		const run = <A, E>(effect: Effect.Effect<A, E, ReposManager>) =>
			Effect.runPromise(effect.pipe(Effect.provide(managerLayer)) as Effect.Effect<A, E>);

		const addResult: ReposAddResult = await run(
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
	});

	it("pins to a branch ref via fallback fetch when tag form fails", async () => {
		const up = makeUpstream();
		const host = makeHost();
		const name = "spec";
		const upstreamUrl = `file://${up}`;

		// Create a branch pointing to a commit
		git(up, "branch", "stable", "1.0.0");
		const stableSha = git(up, "rev-parse", "stable").trim();

		const configStoreLayer = ReposConfigStoreLive.pipe(Layer.provide(NodeContext.layer));
		const managerLayer = ReposManagerLive.pipe(Layer.provide(configStoreLayer), Layer.provide(NodeContext.layer));
		const run = <A, E>(effect: Effect.Effect<A, E, ReposManager>) =>
			Effect.runPromise(effect.pipe(Effect.provide(managerLayer)) as Effect.Effect<A, E>);

		// First add the repo with tag ref
		await run(
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
		const pinResult: ReposPinResult = await run(
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
	});

	it("preserves untouched entries when pinning one of many repos in the manifest", async () => {
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

		const configStoreLayer = ReposConfigStoreLive.pipe(Layer.provide(NodeContext.layer));
		const managerLayer = ReposManagerLive.pipe(Layer.provide(configStoreLayer), Layer.provide(NodeContext.layer));
		const run = <A, E>(effect: Effect.Effect<A, E, ReposManager>) =>
			Effect.runPromise(effect.pipe(Effect.provide(managerLayer)) as Effect.Effect<A, E>);

		const upstreamUrl1 = `file://${up1}`;
		const upstreamUrl2 = `file://${up2}`;

		// Add two repos
		await run(
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

		await run(
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

		await run(
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
	});

	it("rejects an invalid --name before any side effect (path traversal)", async () => {
		const up = makeUpstream();
		const host = makeHost();
		const upstreamUrl = `file://${up}`;

		const configStoreLayer = ReposConfigStoreLive.pipe(Layer.provide(NodeContext.layer));
		const managerLayer = ReposManagerLive.pipe(Layer.provide(configStoreLayer), Layer.provide(NodeContext.layer));
		const runExit = <A, E>(effect: Effect.Effect<A, E, ReposManager>) =>
			Effect.runPromiseExit(effect.pipe(Effect.provide(managerLayer)) as Effect.Effect<A, E>);

		const exit = await runExit(
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
		if (exit._tag === "Failure" && exit.cause._tag === "Fail") {
			expect(exit.cause.error).toMatchObject({ _tag: "ReposConfigError", kind: "invalid" });
			expect((exit.cause.error as { reason: string }).reason).toContain("../evil");
		}

		// No side effects: no manifest ever created, and no git changes staged
		// or committed (the submodule add never ran).
		expect(existsSync(join(host, ".repos"))).toBe(false);
		expect(existsSync(join(host, "..", "evil"))).toBe(false);
		expect(git(host, "status", "--porcelain").trim()).toBe("");
	});

	it("fails cleanly on a duplicate name: manifest byte-identical, no git error state", async () => {
		const up = makeUpstream();
		const host = makeHost();
		const name = "spec";
		const upstreamUrl = `file://${up}`;

		const configStoreLayer = ReposConfigStoreLive.pipe(Layer.provide(NodeContext.layer));
		const managerLayer = ReposManagerLive.pipe(Layer.provide(configStoreLayer), Layer.provide(NodeContext.layer));
		const run = <A, E>(effect: Effect.Effect<A, E, ReposManager>) =>
			Effect.runPromise(effect.pipe(Effect.provide(managerLayer)) as Effect.Effect<A, E>);
		const runExit = <A, E>(effect: Effect.Effect<A, E, ReposManager>) =>
			Effect.runPromiseExit(effect.pipe(Effect.provide(managerLayer)) as Effect.Effect<A, E>);

		await run(
			Effect.gen(function* () {
				const manager = yield* ReposManager;
				return yield* manager.add(host, { url: upstreamUrl, ref: "1.0.0", purpose: "spec authority", name });
			}),
		);

		const manifestPath = join(host, ".repos", "config.json");
		const manifestBefore = readFileSync(manifestPath, "utf8");

		const exit = await runExit(
			Effect.gen(function* () {
				const manager = yield* ReposManager;
				return yield* manager.add(host, { url: upstreamUrl, ref: "1.0.0", purpose: "duplicate attempt", name });
			}),
		);

		expect(exit._tag).toBe("Failure");
		if (exit._tag === "Failure" && exit.cause._tag === "Fail") {
			expect(exit.cause.error).toMatchObject({ _tag: "ReposConfigError", kind: "invalid" });
			expect((exit.cause.error as { reason: string }).reason).toContain("already vendored");
		}

		const manifestAfter = readFileSync(manifestPath, "utf8");
		expect(manifestAfter).toBe(manifestBefore);
	});
});

describe("ReposManager.status — propagates git failures", () => {
	it("fails with GitSubmoduleError instead of reporting a clean/null status when the git invocation fails", async () => {
		const root = mkdtempSync(join(tmpdir(), "repos-manager-status-git-fail-"));

		const manifest: ReposManifestFile = {
			repos: { spec: { url: "https://example.com/spec.git", ref: "1.0.0", purpose: "spec authority" } },
		};
		const configStoreStub = Layer.succeed(ReposConfigStore, {
			exists: () => Effect.succeed(true),
			read: () => Effect.succeed(manifest),
			write: () => Effect.succeed(undefined),
		} as never);

		// An executor whose every invocation fails: before the fix, status
		// swallowed this via orElseSucceed and reported commit null / dirty
		// false as if everything were fine.
		const failingExecutorStub = Layer.succeed(CommandExecutor.CommandExecutor, {
			string: () => Effect.fail(new Error("git exploded")),
		} as never);

		const exit = await Effect.runPromiseExit(
			Effect.gen(function* () {
				const manager = yield* ReposManager;
				return yield* manager.status(root);
			}).pipe(
				Effect.provide(ReposManagerLive),
				Effect.provide(configStoreStub),
				Effect.provide(failingExecutorStub),
				Effect.provide(NodeContext.layer),
			) as Effect.Effect<unknown, unknown>,
		);

		expect(exit._tag).toBe("Failure");
		if (exit._tag === "Failure" && exit.cause._tag === "Fail") {
			expect(exit.cause.error).toMatchObject({ _tag: "GitSubmoduleError" });
		}
	});
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

	function run<A, E>(effect: Effect.Effect<A, E, ReposManager>, configStore: Layer.Layer<ReposConfigStore>) {
		return Effect.runPromise(
			effect.pipe(
				Effect.provide(ReposManagerLive),
				Effect.provide(configStore),
				Effect.provide(NodeContext.layer),
			) as Effect.Effect<A, E>,
		);
	}

	function runExit<A>(effect: Effect.Effect<A, unknown, ReposManager>, configStore: Layer.Layer<ReposConfigStore>) {
		return Effect.runPromiseExit(
			effect.pipe(
				Effect.provide(ReposManagerLive),
				Effect.provide(configStore),
				Effect.provide(NodeContext.layer),
			) as Effect.Effect<unknown, unknown>,
		);
	}

	it("add stamps an n-prefixed id, today's date, and the entry's current ref", async () => {
		const { configStore, getManifest } = makeConfigStore({ repos: { spec: baseEntry } });
		const root = "/virtual/root";
		const today = new Date().toISOString().slice(0, 10);

		const result: ReposNoteResult = await run(
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
	});

	it("fails the 11th add with the note-limit message", async () => {
		const seedNotes = Array.from({ length: 10 }, (_, i) => ({
			id: `n-seed${i}`,
			date: "2026-01-01",
			ref: "1.0.0",
			note: `seed note ${i}`,
		}));
		const { configStore } = makeConfigStore({ repos: { spec: { ...baseEntry, notes: seedNotes } } });
		const root = "/virtual/root";

		const exit = await runExit(
			Effect.gen(function* () {
				const manager = yield* ReposManager;
				return yield* manager.note(root, "spec", { op: "add", note: "one too many" });
			}),
			configStore,
		);

		expect(exit._tag).toBe("Failure");
		if (exit._tag === "Failure" && exit.cause._tag === "Fail") {
			expect(exit.cause.error).toMatchObject({
				_tag: "ReposConfigError",
				reason: "note limit (10) reached for spec; promote or remove notes first",
			});
		}
	});

	it("remove drops the note by id and reports the remaining count", async () => {
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

		const result = await run(
			Effect.gen(function* () {
				const manager = yield* ReposManager;
				return yield* manager.note(root, "spec", { op: "remove", id: "n-bbbb" });
			}),
			configStore,
		);

		expect(result).toEqual({ name: "spec", op: "remove", id: "n-bbbb", noteCount: 1 });
		expect(getManifest().repos.spec?.notes?.map((n) => n.id)).toEqual(["n-aaaa"]);
	});

	it("remove fails with NoteNotFoundError for an unknown id", async () => {
		const { configStore } = makeConfigStore({ repos: { spec: { ...baseEntry, notes: [] } } });
		const root = "/virtual/root";

		const exit = await runExit(
			Effect.gen(function* () {
				const manager = yield* ReposManager;
				return yield* manager.note(root, "spec", { op: "remove", id: "does-not-exist" });
			}),
			configStore,
		);

		expect(exit._tag).toBe("Failure");
		if (exit._tag === "Failure" && exit.cause._tag === "Fail") {
			expect(exit.cause.error).toMatchObject({ _tag: "NoteNotFoundError", name: "spec", id: "does-not-exist" });
		}
	});

	it("promote moves note text into orientation.startHere and removes the note", async () => {
		const { configStore, getManifest } = makeConfigStore({
			repos: {
				spec: {
					...baseEntry,
					notes: [{ id: "n-cccc", date: "2026-01-01", ref: "1.0.0", note: "start reading at src/index.ts" }],
				},
			},
		});
		const root = "/virtual/root";

		const result = await run(
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
	});

	it("promote fails with NoteNotFoundError for an unknown id", async () => {
		const { configStore } = makeConfigStore({ repos: { spec: { ...baseEntry, notes: [] } } });
		const root = "/virtual/root";

		const exit = await runExit(
			Effect.gen(function* () {
				const manager = yield* ReposManager;
				return yield* manager.note(root, "spec", { op: "promote", id: "does-not-exist", into: "layout" });
			}),
			configStore,
		);

		expect(exit._tag).toBe("Failure");
		if (exit._tag === "Failure" && exit.cause._tag === "Fail") {
			expect(exit.cause.error).toMatchObject({ _tag: "NoteNotFoundError", name: "spec", id: "does-not-exist" });
		}
	});

	it("produces distinct ids for identical note text (collision extends to 8 hex chars)", async () => {
		const { configStore } = makeConfigStore({ repos: { spec: baseEntry } });
		const root = "/virtual/root";

		const first = await run(
			Effect.gen(function* () {
				const manager = yield* ReposManager;
				return yield* manager.note(root, "spec", { op: "add", note: "same text" });
			}),
			configStore,
		);

		const second = await run(
			Effect.gen(function* () {
				const manager = yield* ReposManager;
				return yield* manager.note(root, "spec", { op: "add", note: "same text" });
			}),
			configStore,
		);

		expect(first.id).not.toBe(second.id);
		expect(first.id).toMatch(/^n-[0-9a-f]{4}$/);
		expect(second.id).toMatch(/^n-[0-9a-f]{8}$/);
	});

	it("extends past 8 hex chars for a third identical note, keeping all three ids distinct", async () => {
		const { configStore, getManifest } = makeConfigStore({ repos: { spec: baseEntry } });
		const root = "/virtual/root";

		const first = await run(
			Effect.gen(function* () {
				const manager = yield* ReposManager;
				return yield* manager.note(root, "spec", { op: "add", note: "same text" });
			}),
			configStore,
		);
		const second = await run(
			Effect.gen(function* () {
				const manager = yield* ReposManager;
				return yield* manager.note(root, "spec", { op: "add", note: "same text" });
			}),
			configStore,
		);
		const third = await run(
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
		const afterRemove = await run(
			Effect.gen(function* () {
				const manager = yield* ReposManager;
				return yield* manager.note(root, "spec", { op: "remove", id: second.id });
			}),
			configStore,
		);
		expect(afterRemove.noteCount).toBe(2);
		expect(getManifest().repos.spec?.notes?.map((n) => n.id)).toEqual([first.id, third.id]);
	});

	it("fails with RepoNotFoundError when the repo is absent from the manifest", async () => {
		const { configStore } = makeConfigStore({ repos: {} });
		const root = "/virtual/root";

		const exit = await runExit(
			Effect.gen(function* () {
				const manager = yield* ReposManager;
				return yield* manager.note(root, "does-not-exist", { op: "add", note: "hello" });
			}),
			configStore,
		);

		expect(exit._tag).toBe("Failure");
		if (exit._tag === "Failure" && exit.cause._tag === "Fail") {
			expect(exit.cause.error).toMatchObject({ _tag: "RepoNotFoundError", name: "does-not-exist" });
		}
	});
});
