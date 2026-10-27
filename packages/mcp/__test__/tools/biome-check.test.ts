import { mkdirSync, mkdtempSync, realpathSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "@effect/vitest";
import { ResolvedTool, ScriptedSpawner, ToolDiscovery, ToolNotFoundError } from "@effected/commands";
import { Exclusive } from "@effected/engine";
import { Git, GitCommandError, TreeIdentity } from "@effected/git";
import { Deferred, Effect, Fiber, Layer, Option, Result, Schema } from "effect";

import {
	BiomeCheckResult,
	buildBiomeResult,
	parseBiomeGitlab,
	resolveContainmentRoot,
	runBiomeCheck,
} from "../../src/tools/biome-check.js";

const SAMPLE = JSON.stringify([
	{
		description: "Unexpected any.",
		check_name: "lint/suspicious/noExplicitAny",
		fingerprint: "abc",
		severity: "critical",
		location: { path: "src/x.ts", lines: { begin: 12 } },
	},
	{
		description: "Forgotten semicolon style.",
		check_name: "format",
		fingerprint: "def",
		severity: "major",
		location: { path: "src/y.ts", lines: { begin: 3 } },
	},
]);

describe("parseBiomeGitlab", () => {
	it("maps gitlab diagnostics and normalizes severity", () => {
		const diags = parseBiomeGitlab(SAMPLE);
		expect(diags).toHaveLength(2);
		expect(diags[0]).toEqual({
			file: "src/x.ts",
			line: 12,
			severity: "error",
			rule: "lint/suspicious/noExplicitAny",
			message: "Unexpected any.",
		});
		expect(diags[1].severity).toBe("warning");
	});

	// Biome's gitlab reporter (crates/biome_cli/src/reporter/gitlab.rs) maps its own
	// Severity onto GitLab's codequality scale: Hint => info, Information => minor,
	// Warning => major, Error => critical, Fatal => blocker. Reading "major" as an
	// error shifts every level one step too severe — systems#516.
	it("inverts the gitlab reporter's severity table exactly", () => {
		const cases = [
			["info", "info"],
			["minor", "info"],
			["major", "warning"],
			["critical", "error"],
			["blocker", "error"],
		] as const;
		for (const [gitlab, expected] of cases) {
			const [diag] = parseBiomeGitlab(
				JSON.stringify([
					{
						description: "d",
						check_name: "r",
						severity: gitlab,
						location: { path: "a.ts", lines: { begin: 1 } },
					},
				]),
			);
			expect(diag?.severity, `gitlab "${gitlab}" should normalize to "${expected}"`).toBe(expected);
		}
	});

	it("does not report a project warning as an error (systems#516)", () => {
		const diags = parseBiomeGitlab(
			JSON.stringify([
				{
					description: "This import is unused.",
					check_name: "lint/correctness/noUnusedImports",
					severity: "major",
					location: { path: "src/x.ts", lines: { begin: 1 } },
				},
			]),
		);
		expect(diags[0]?.severity).toBe("warning");
		const result = buildBiomeResult({ diagnostics: diags, wrote: false });
		expect(result.summary).toEqual({ errors: 0, warnings: 1 });
	});

	it("returns [] for empty or invalid stdout", () => {
		expect(parseBiomeGitlab("")).toEqual([]);
		expect(parseBiomeGitlab("   ")).toEqual([]);
		expect(parseBiomeGitlab("not json")).toEqual([]);
		expect(parseBiomeGitlab("{}")).toEqual([]);
	});
});

describe("buildBiomeResult", () => {
	it("counts severities and carries the wrote flag + guidance", () => {
		const diags = parseBiomeGitlab(SAMPLE);
		const result = buildBiomeResult({ diagnostics: diags, wrote: true });
		expect(result.summary).toEqual({ errors: 1, warnings: 1 });
		expect(result.wrote).toBe(true);
		expect(result.diagnostics).toHaveLength(2);
		expect(result.guidance).toContain("Do NOT disable rules");
	});

	it("honors project severities by default: warnings stay warnings with non-blocking guidance", () => {
		const diags = parseBiomeGitlab(SAMPLE).filter((d) => d.severity === "warning");
		const result = buildBiomeResult({ diagnostics: diags, wrote: false });
		expect(result.summary).toEqual({ errors: 0, warnings: 1 });
		expect(result.diagnostics[0].severity).toBe("warning");
		expect(result.diagnostics[0].originalSeverity).toBeUndefined();
		expect(result.guidance).toContain("do not block");
	});

	it("strict upgrades warnings to errors, preserving originalSeverity and counting the upgrade", () => {
		const diags = parseBiomeGitlab(SAMPLE);
		const result = buildBiomeResult({ diagnostics: diags, wrote: false, strict: true });
		expect(result.summary).toEqual({ errors: 2, warnings: 0, upgradedWarnings: 1 });
		const upgraded = result.diagnostics.find((d) => d.rule === "format");
		expect(upgraded?.severity).toBe("error");
		expect(upgraded?.originalSeverity).toBe("warning");
		const real = result.diagnostics.find((d) => d.rule === "lint/suspicious/noExplicitAny");
		expect(real?.severity).toBe("error");
		expect(real?.originalSeverity).toBeUndefined();
		expect(result.guidance).toContain("not CI blockers");
	});
});

/** A global Biome resolution: `command()` is the bare `biome` argv. */
const GLOBAL_BIOME = ResolvedTool.make({
	name: "biome",
	source: "global",
	version: Option.none(),
	globalVersion: Option.none(),
	localVersion: Option.none(),
	mismatch: false,
});

const DiscoveryFound = ToolDiscovery.layerTest({ resolve: () => Effect.succeed(GLOBAL_BIOME) });
const DiscoveryMissing = ToolDiscovery.layerTest({
	resolve: (tool) => Effect.fail(new ToolNotFoundError({ tool: tool.name, searched: ["global", "local"] })),
});

/** `TreeIdentity` per directory; an unlisted directory is in no working tree. */
const gitWith = (map: Record<string, { commonDir: string; toplevel: string }>) =>
	Git.layerTest({
		treeIdentity: (dir) =>
			Effect.succeed(Option.fromNullishOr(map[dir]).pipe(Option.map((id) => TreeIdentity.make(id)))),
	});

/** No directory is in a working tree. Bound once: layers memoize by reference. */
const GitNone = gitWith({});

/** A spawner that answers every Biome spawn with an empty gitlab report. */
const cleanSpawner = () => ScriptedSpawner.make(() => ({ stdout: "[]", exit: 0 }));

/** Run the handler under test doubles, with a fresh write lane. */
const run = (
	args: Parameters<typeof runBiomeCheck>[0],
	fallbackCwd: string,
	layers: {
		readonly git?: Layer.Layer<Git>;
		readonly discovery?: Layer.Layer<ToolDiscovery>;
		readonly spawner?: ScriptedSpawner;
	} = {},
) =>
	Effect.flatMap(Exclusive.make, (lane) => runBiomeCheck(args, fallbackCwd, lane)).pipe(
		Effect.provide(
			Layer.mergeAll(
				layers.git ?? GitNone,
				layers.discovery ?? DiscoveryFound,
				(layers.spawner ?? cleanSpawner()).layer,
			),
		),
	);

describe("runBiomeCheck containment", () => {
	// These reject during path resolution, before any Biome lookup or spawn.
	it.effect("rejects a cwd outside the workspace root", () =>
		Effect.gen(function* () {
			const error = yield* Effect.flip(run({ cwd: "/etc", write: true }, "/repo"));
			expect(error._tag).toBe("ToolRefusal");
			expect(error.message).toMatch(/escapes the workspace root/);
		}),
	);

	it.effect("rejects a relative path that escapes the workspace root", () =>
		Effect.gen(function* () {
			const error = yield* Effect.flip(run({ paths: ["../../etc"], write: true }, "/repo"));
			expect(error.message).toMatch(/escapes the workspace root/);
		}),
	);

	it.effect("rejects an absolute path outside the workspace root", () =>
		Effect.gen(function* () {
			const error = yield* Effect.flip(run({ paths: ["/etc/passwd"] }, "/repo"));
			expect(error.message).toMatch(/escapes the workspace root/);
		}),
	);

	it.effect("rejects a symlinked path whose target escapes the workspace root (write mode)", () =>
		Effect.gen(function* () {
			const base = realpathSync(mkdtempSync(join(tmpdir(), "biome-cont-")));
			const root = join(base, "workspace");
			const outside = join(base, "outside");
			mkdirSync(root);
			mkdirSync(outside);
			writeFileSync(join(outside, "evil.ts"), "const x = 1;\n");
			symlinkSync(join(outside, "evil.ts"), join(root, "link.ts"));
			const spawner = cleanSpawner();
			const error = yield* Effect.flip(run({ paths: ["link.ts"], write: true }, root, { spawner })).pipe(
				Effect.ensuring(Effect.sync(() => rmSync(base, { recursive: true, force: true }))),
			);
			expect(error.message).toMatch(/escapes the workspace root/);
			expect(spawner.spawns).toHaveLength(0);
		}),
	);

	it.effect("rejects a symlinked cwd whose target escapes the workspace root", () =>
		Effect.gen(function* () {
			const base = realpathSync(mkdtempSync(join(tmpdir(), "biome-cont-")));
			const root = join(base, "workspace");
			const outside = join(base, "outside");
			mkdirSync(root);
			mkdirSync(outside);
			symlinkSync(outside, join(root, "linkdir"));
			const error = yield* Effect.flip(run({ cwd: join(root, "linkdir"), write: true }, root)).pipe(
				Effect.ensuring(Effect.sync(() => rmSync(base, { recursive: true, force: true }))),
			);
			expect(error.message).toMatch(/escapes the workspace root/);
		}),
	);
});

describe("resolveContainmentRoot (systems#482)", () => {
	// A root-bound tool invoked from a sibling worktree silently operated on the
	// MAIN checkout — in a parallel multi-agent session, another agent's tree.
	// Containment must follow the worktree, not the server's start directory.
	const resolveWith = (root: string, cwd: string, git: Layer.Layer<Git>) =>
		resolveContainmentRoot(root, cwd).pipe(Effect.map(Option.getOrNull), Effect.provide(git));

	it.effect("keeps the root for a cwd inside it, without asking git", () =>
		Effect.gen(function* () {
			// Git.layerTest() dies on any call, so this also proves no probe ran.
			const noCalls = Git.layerTest();
			expect(yield* resolveWith("/repo", "/repo/packages/mcp", noCalls)).toBe("/repo");
			expect(yield* resolveWith("/repo", "/repo", noCalls)).toBe("/repo");
		}),
	);

	it.effect("accepts a worktree of the same repository and contains to that worktree", () =>
		Effect.gen(function* () {
			const git = gitWith({
				"/repo": { commonDir: "/repo/.git", toplevel: "/repo" },
				"/wt/feature/src": { commonDir: "/repo/.git", toplevel: "/wt/feature" },
			});
			expect(yield* resolveWith("/repo", "/wt/feature/src", git)).toBe("/wt/feature");
		}),
	);

	it.effect("rejects a worktree of a different repository", () =>
		Effect.gen(function* () {
			const git = gitWith({
				"/repo": { commonDir: "/repo/.git", toplevel: "/repo" },
				"/other": { commonDir: "/other/.git", toplevel: "/other" },
			});
			expect(yield* resolveWith("/repo", "/other", git)).toBeNull();
		}),
	);

	it.effect("rejects a directory that is not a git repository", () =>
		Effect.gen(function* () {
			const git = gitWith({ "/repo": { commonDir: "/repo/.git", toplevel: "/repo" } });
			expect(yield* resolveWith("/repo", "/etc", git)).toBeNull();
		}),
	);

	it.effect("rejects when the root itself is not a git repository", () =>
		Effect.gen(function* () {
			const git = gitWith({ "/wt": { commonDir: "/repo/.git", toplevel: "/wt" } });
			expect(yield* resolveWith("/repo", "/wt", git)).toBeNull();
		}),
	);

	it.effect("rejects when git itself fails (treated as an unknown identity)", () =>
		Effect.gen(function* () {
			const git = Git.layerTest({
				treeIdentity: (dir) =>
					Effect.fail(
						new GitCommandError({ kind: "failed", args: ["rev-parse"], cwd: dir, exitCode: 128, stderr: "boom" }),
					),
			});
			expect(yield* resolveWith("/repo", "/wt", git)).toBeNull();
		}),
	);

	// The server is launched from packages/mcp/ by dev tooling, so root can be a
	// strict subdirectory of its own worktree. Both identities then name the SAME
	// tree — widening to the worktree top level would hand --write the whole repo,
	// including the .repos/** vendored trees.
	it.effect("does not widen when root is a subdirectory of its own worktree", () =>
		Effect.gen(function* () {
			const git = gitWith({
				"/repo/packages/mcp": { commonDir: "/repo/.git", toplevel: "/repo" },
				"/repo/packages/silk": { commonDir: "/repo/.git", toplevel: "/repo" },
			});
			expect(yield* resolveWith("/repo/packages/mcp", "/repo/packages/silk", git)).toBeNull();
		}),
	);

	it.effect("still contains to the worktree when root is a subdirectory of a DIFFERENT worktree", () =>
		Effect.gen(function* () {
			const git = gitWith({
				"/repo/packages/mcp": { commonDir: "/repo/.git", toplevel: "/repo" },
				"/wt/feature/packages/silk": { commonDir: "/repo/.git", toplevel: "/wt/feature" },
			});
			expect(yield* resolveWith("/repo/packages/mcp", "/wt/feature/packages/silk", git)).toBe("/wt/feature");
		}),
	);

	it.effect("does not treat a lexical prefix as containment", () =>
		Effect.gen(function* () {
			expect(yield* resolveWith("/repo", "/repo-evil", GitNone)).toBeNull();
		}),
	);
});

describe("runBiomeCheck running Biome", () => {
	it.effect("runs a write pass then a gitlab read pass in the request cwd, hard-killed on timeout", () =>
		Effect.gen(function* () {
			const spawner = ScriptedSpawner.make((_command, args) =>
				args.includes("--reporter=gitlab") ? { stdout: SAMPLE, exit: 1 } : { exit: 0 },
			);
			const result = yield* run({ paths: ["src"], write: true, unsafe: true }, "/repo", { spawner });
			expect(result.wrote).toBe(true);
			expect(result.summary).toEqual({ errors: 1, warnings: 1 });
			expect(spawner.spawns.map((s) => [s.command, s.args, s.cwd])).toEqual([
				["biome", ["check", "--write", "--unsafe", "--no-errors-on-unmatched", "src"], "/repo"],
				["biome", ["check", "--reporter=gitlab", "--no-errors-on-unmatched", "src"], "/repo"],
			]);
			expect(spawner.spawns.every((s) => s.options.killSignal === "SIGKILL")).toBe(true);
		}),
	);

	it.effect("runs a sibling worktree's request in that worktree", () =>
		Effect.gen(function* () {
			const git = gitWith({
				"/repo": { commonDir: "/repo/.git", toplevel: "/repo" },
				"/wt/feature": { commonDir: "/repo/.git", toplevel: "/wt/feature" },
			});
			const spawner = cleanSpawner();
			const result = yield* run({ cwd: "/wt/feature", mode: "lint" }, "/repo", { git, spawner });
			expect(result.wrote).toBe(false);
			expect(spawner.spawns.map((s) => [s.args, s.cwd])).toEqual([
				[["lint", "--reporter=gitlab", "--no-errors-on-unmatched", "."], "/wt/feature"],
			]);
		}),
	);

	it.effect("refuses with 'Biome not found.' when discovery finds no binary", () =>
		Effect.gen(function* () {
			const spawner = cleanSpawner();
			const error = yield* Effect.flip(run({}, "/repo", { discovery: DiscoveryMissing, spawner }));
			expect(error._tag).toBe("ToolRefusal");
			expect(error.message).toMatch(/Biome not found\./);
			expect(spawner.spawns).toHaveLength(0);
		}),
	);

	it.effect("reports an exit status above 1 as BiomeFailed carrying the exit code and stderr", () =>
		Effect.gen(function* () {
			const spawner = ScriptedSpawner.make(() => ({ stderr: "bad config\n", exit: 2 }));
			const error = yield* Effect.flip(run({}, "/repo", { spawner }));
			expect(error._tag).toBe("BiomeFailed");
			expect(error._tag === "BiomeFailed" && error.exitCode).toBe(2);
			expect(error.message).toMatch(/Biome failed \(exit 2\): bad config/);
		}),
	);

	it.effect("stops after a failing write pass, before the read pass", () =>
		Effect.gen(function* () {
			const spawner = ScriptedSpawner.make(() => ({ stderr: "crash", exit: 3 }));
			const error = yield* Effect.flip(run({ write: true }, "/repo", { spawner }));
			expect(error.message).toMatch(/Biome --write failed \(exit 3\): crash/);
			expect(spawner.spawns).toHaveLength(1);
		}),
	);

	it.effect("reports a spawn failure as BiomeFailed", () =>
		Effect.gen(function* () {
			const spawner = ScriptedSpawner.make((command) => ScriptedSpawner.permissionDenied(command));
			const error = yield* Effect.flip(run({}, "/repo", { spawner }));
			expect(error._tag).toBe("BiomeFailed");
			expect(error.message).toMatch(/Biome could not run/);
		}),
	);

	it.effect("waits for the write lane before a write pass; a read-only call does not", () =>
		Effect.gen(function* () {
			const spawner = cleanSpawner();
			const lane = yield* Exclusive.make;
			const held = yield* Deferred.make<void>();
			const release = yield* Deferred.make<void>();
			const env = Layer.mergeAll(GitNone, DiscoveryFound, spawner.layer);

			// Another write holds the lane until `release` completes.
			const holder = yield* lane
				.run(Effect.andThen(Deferred.succeed(held, undefined), Deferred.await(release)), { timeout: "1 minute" })
				.pipe(Effect.forkChild);
			yield* Deferred.await(held);

			const writer = yield* runBiomeCheck({ write: true }, "/repo", lane).pipe(Effect.provide(env), Effect.forkChild);
			// A read-only call is not serialized: it completes while the lane is held.
			const read = yield* runBiomeCheck({}, "/repo", lane).pipe(Effect.provide(env));
			expect(read.wrote).toBe(false);
			for (let i = 0; i < 20; i++) yield* Effect.yieldNow;
			expect(spawner.spawns.filter((s) => s.args.includes("--write"))).toHaveLength(0);

			yield* Deferred.succeed(release, undefined);
			yield* Fiber.join(holder);
			const written = yield* Fiber.join(writer);
			expect(written.wrote).toBe(true);
			expect(spawner.spawns.filter((s) => s.args.includes("--write"))).toHaveLength(1);
		}),
	);
});

describe("biome_check served schema", () => {
	it("the result schema accepts a valid payload", () => {
		const parsed = Schema.decodeUnknownResult(BiomeCheckResult)({
			summary: { errors: 0, warnings: 0 },
			diagnostics: [],
			wrote: false,
			guidance: "x",
		});
		expect(Result.isSuccess(parsed)).toBe(true);
	});
});
