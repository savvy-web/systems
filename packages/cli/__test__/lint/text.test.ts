import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { NodeServices } from "@effect/platform-node";
import { afterEach, beforeEach, describe, expect, it } from "@effect/vitest";
import { Git, LsFilesEntry } from "@effected/git";
import { MemoryFileSystem } from "@effected/memfs";
import { Effect, Layer, Path } from "effect";
import { ChildProcessSpawner } from "effect/process";
import { runLintText } from "../../src/commands/lint/text.js";
import { Capture } from "../utils/capture.js";

const entry = (path: string, mode = "100644") => LsFilesEntry.make({ mode, oid: "0".repeat(40), stage: 0, path });

const volume = MemoryFileSystem.layerWith({
	"/repo/src/ok.ts": "export const ok = true;\n",
	"/repo/src/nul.ts": Uint8Array.of(0x61, 0x0a, 0x62, 0x00, 0x0a),
	"/repo/docs/latin1.md": Uint8Array.of(0x63, 0x61, 0x66, 0xe9, 0x0a),
	"/repo/assets/logo.png": Uint8Array.of(0x89, 0x50, 0x4e, 0x47, 0x00),
});

/** A git index listing every seeded file, so the tracked mode has a binary to skip. */
const trackedGit = Git.layerTest({
	lsFiles: () =>
		Effect.succeed([entry("src/ok.ts"), entry("src/nul.ts"), entry("docs/latin1.md"), entry("assets/logo.png")]),
});

/** Fails loudly if file-argument mode ever consults the index. */
const untouchedGit = Git.layerTest({ lsFiles: () => Effect.die("lsFiles must not run when files are given") });

/** Fails loudly if a worktree-mode run ever spawns (the index read is `--staged` only). */
const noSpawn = Layer.succeed(
	ChildProcessSpawner.ChildProcessSpawner,
	ChildProcessSpawner.make(() => Effect.die("spawn must not run without --staged")),
);

const stack = (git: Layer.Layer<Git>) => Layer.mergeAll(volume, git, Path.layer, noSpawn, Capture.piped);

describe("savvy lint text", () => {
	it.effect("passes clean files given as arguments and exits 0", () =>
		Effect.gen(function* () {
			const result = yield* Capture.run(runLintText(["/repo/src/ok.ts"]));
			expect(result.exitCode).toBe(0);
			expect(result.value).toEqual([]);
			expect(result.stdout).toEqual(["✓ 1 file is grep-visible text"]);
		}).pipe(Effect.provide(stack(untouchedGit))),
	);

	it.effect("prints one path:line:col line per finding and exits 1", () =>
		Effect.gen(function* () {
			const result = yield* Capture.run(runLintText(["/repo/src/ok.ts", "/repo/src/nul.ts", "/repo/docs/latin1.md"]));
			expect(result.exitCode).toBe(1);
			expect(result.stdout[0]).toMatch(
				/^✗ \/repo\/src\/nul\.ts:2:2 {2}contains a NUL byte — write it as the \\0 escape/,
			);
			expect(result.stdout[1]).toMatch(/^✗ \/repo\/docs\/latin1\.md:1:4 {2}is not valid UTF-8 \(byte offset 3\)/);
			expect(result.stdout[2]).toBe("1 ok · 2 failed");
			expect(result.stderr).toEqual([]);
		}).pipe(Effect.provide(stack(untouchedGit))),
	);

	it.effect("with no arguments checks the git-tracked files that match the glob", () =>
		Effect.gen(function* () {
			const result = yield* Capture.run(runLintText([], { cwd: "/repo" }));
			expect(result.exitCode).toBe(1);
			expect(result.value.map((finding) => finding.path)).toEqual(["/repo/src/nul.ts", "/repo/docs/latin1.md"]);
			// The PNG is tracked but out of scope, so its NUL is never reported.
			expect(result.stdout.join("\n")).not.toContain("logo.png");
		}).pipe(Effect.provide(stack(trackedGit))),
	);

	it.effect("with no arguments over a clean index exits 0", () =>
		Effect.gen(function* () {
			const result = yield* Capture.run(runLintText([], { cwd: "/repo" }));
			expect(result.exitCode).toBe(0);
			expect(result.stdout).toEqual(["✓ 1 file is grep-visible text"]);
		}).pipe(Effect.provide(stack(Git.layerTest({ lsFiles: () => Effect.succeed([entry("src/ok.ts")]) })))),
	);
});

/**
 * `--staged` reads the git index, which memfs cannot model: a real temp repo
 * whose staged blob and worktree file disagree.
 */
describe("savvy lint text --staged (real temp git repo)", () => {
	let root: string;
	const git = (...args: ReadonlyArray<string>) => execFileSync("git", args, { cwd: root, stdio: "pipe" });

	beforeEach(() => {
		root = mkdtempSync(join(tmpdir(), "lint-text-staged-"));
		git("init", "-q");
		writeFileSync(join(root, "a.ts"), Uint8Array.of(0x78, 0x00, 0x0a));
		git("add", "a.ts");
		// The worktree is fixed after staging, as if a --write step rewrote it mid-run.
		writeFileSync(join(root, "a.ts"), "x\n");
	});

	afterEach(() => {
		rmSync(root, { recursive: true, force: true });
	});

	it.effect("reports the staged NUL even though the worktree copy is clean", () =>
		Effect.gen(function* () {
			const file = join(root, "a.ts");
			const staged = yield* Capture.run(runLintText([file], { staged: true }));
			expect(staged.exitCode).toBe(1);
			expect(staged.stdout[0]).toBe(
				`✗ ${file}:1:2  contains a NUL byte — write it as the \\0 escape so grep and ripgrep do not skip the file`,
			);
			// Control: without --staged the same path reads the clean worktree copy.
			const worktree = yield* Capture.run(runLintText([file]));
			expect(worktree.exitCode).toBe(0);
		}).pipe(Effect.provide(Capture.piped), Effect.provide(Layer.provideMerge(Git.layer, NodeServices.layer))),
	);

	it.effect("explains an unstaged file on stderr and exits 1", () =>
		Effect.gen(function* () {
			const file = join(root, "never-added.ts");
			writeFileSync(file, "export {};\n");
			const result = yield* Capture.run(runLintText([file], { staged: true }));
			expect(result.exitCode).toBe(1);
			expect(result.stdout).toEqual([]);
			expect(result.stderr.join("\n")).toContain(`cannot read the staged content of ${file}`);
		}).pipe(Effect.provide(Capture.piped), Effect.provide(Layer.provideMerge(Git.layer, NodeServices.layer))),
	);
});
