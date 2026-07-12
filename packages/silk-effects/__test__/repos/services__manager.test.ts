import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { CommandExecutor } from "@effect/platform";
import { NodeContext } from "@effect/platform-node";
import { Effect, Layer } from "effect";
import { describe, expect, it } from "vitest";
import type { ReposManifestFile } from "../../src/repos/schemas/manifest.js";
import type { ReposStatusReport } from "../../src/repos/schemas/reports.js";
import { ReposConfigStore } from "../../src/repos/services/config-store.js";
import { ReposManager, ReposManagerLive } from "../../src/repos/services/manager.js";

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

		// Create stale lock files before syncing
		const lockDirPath = join(host, ".git", "modules", ".repos", name);
		mkdirSync(lockDirPath, { recursive: true });
		writeFileSync(join(lockDirPath, "index.lock"), "");
		writeFileSync(join(lockDirPath, "shallow.lock"), "");

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
});

describe("ReposManager — unimplemented mutations", () => {
	it("add/pin/note die as not-implemented in this task", async () => {
		const configStoreStub = Layer.succeed(ReposConfigStore, {
			exists: () => Effect.succeed(true),
			read: () => Effect.succeed({ repos: {} } as ReposManifestFile),
			write: () => Effect.succeed(undefined),
		} as never);

		const root = mkdtempSync(join(tmpdir(), "repos-manager-stub-"));

		const runDie = (effect: Effect.Effect<unknown, unknown, ReposManager>) =>
			Effect.runPromiseExit(
				effect.pipe(
					Effect.provide(ReposManagerLive),
					Effect.provide(configStoreStub),
					Effect.provide(NodeContext.layer),
				) as Effect.Effect<unknown, unknown>,
			);

		const addExit = await runDie(
			Effect.gen(function* () {
				const manager = yield* ReposManager;
				return yield* manager.add(root, { url: "https://example.com/x.git", ref: "1.0.0", purpose: "x" });
			}),
		);
		expect(addExit._tag).toBe("Failure");

		const pinExit = await runDie(
			Effect.gen(function* () {
				const manager = yield* ReposManager;
				return yield* manager.pin(root, "spec", "2.0.0");
			}),
		);
		expect(pinExit._tag).toBe("Failure");

		const noteExit = await runDie(
			Effect.gen(function* () {
				const manager = yield* ReposManager;
				return yield* manager.note(root, "spec", { op: "add", note: "hello" });
			}),
		);
		expect(noteExit._tag).toBe("Failure");
	});
});
