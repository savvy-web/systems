import { chmodSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, join } from "node:path";
import { NodeFileSystem } from "@effect/platform-node";
import { afterEach, beforeEach, describe, expect, it } from "@effect/vitest";
import { Effect, Exit, Option } from "effect";
import { IoUtil } from "../../src/utils/IoUtil.js";

const isWindows = process.platform === "win32";

const runFs = <A, E>(effect: Effect.Effect<A, E, import("effect").FileSystem.FileSystem>) =>
	Effect.provide(effect, NodeFileSystem.layer);

const runFsExit = <A, E>(effect: Effect.Effect<A, E, import("effect").FileSystem.FileSystem>) =>
	Effect.exit(Effect.provide(effect, NodeFileSystem.layer));

let dirA: string;
let dirB: string;

/** Write a file and mark it executable on POSIX. On Windows the name carries an extension. */
const writeExecutable = (dir: string, name: string): string => {
	const filename = isWindows ? `${name}.cmd` : name;
	const filePath = join(dir, filename);
	writeFileSync(filePath, isWindows ? "@echo off\n" : "#!/bin/sh\necho hi\n");
	if (!isWindows) {
		chmodSync(filePath, 0o755);
	}
	return filePath;
};

beforeEach(() => {
	dirA = mkdtempSync(join(tmpdir(), "ioutil-a-"));
	dirB = mkdtempSync(join(tmpdir(), "ioutil-b-"));
});

afterEach(() => {
	rmSync(dirA, { recursive: true, force: true });
	rmSync(dirB, { recursive: true, force: true });
});

describe("IoUtil.findInPath", () => {
	it.effect("returns all matches across PATH directories", () =>
		Effect.gen(function* () {
			const a = writeExecutable(dirA, "mytool");
			const b = writeExecutable(dirB, "mytool");
			process.env.PATH = [dirA, dirB].join(delimiter);

			const matches = yield* runFs(IoUtil.findInPath("mytool"));

			expect(matches).toContain(a);
			expect(matches).toContain(b);
			expect(matches).toHaveLength(2);
		}),
	);

	it.effect("returns [] for a tool not on PATH", () =>
		Effect.gen(function* () {
			process.env.PATH = [dirA, dirB].join(delimiter);
			const matches = yield* runFs(IoUtil.findInPath("definitely-not-a-real-tool-xyz"));
			expect(matches).toEqual([]);
		}),
	);

	it.effect("skips empty PATH segments", () =>
		Effect.gen(function* () {
			const a = writeExecutable(dirA, "mytool");
			// Leading, trailing and doubled delimiters produce empty segments.
			process.env.PATH = [``, dirA, ``, ``].join(delimiter);
			const matches = yield* runFs(IoUtil.findInPath("mytool"));
			expect(matches).toEqual([a]);
		}),
	);

	it.effect("resolves a tool that already contains a path separator directly", () =>
		Effect.gen(function* () {
			const a = writeExecutable(dirA, "mytool");
			// Empty PATH: the only way to find it is the direct separator path.
			process.env.PATH = "";
			const sepName = isWindows ? "mytool.cmd" : "mytool";
			const matches = yield* runFs(IoUtil.findInPath(join(dirA, sepName)));
			expect(matches).toContain(a);
		}),
	);

	it.effect.runIf(isWindows)("tries each PATHEXT extension on Windows", () =>
		Effect.gen(function* () {
			writeExecutable(dirA, "wintool"); // creates wintool.cmd
			process.env.PATH = dirA;
			process.env.PATHEXT = ".COM;.EXE;.BAT;.CMD";
			const matches = yield* runFs(IoUtil.findInPath("wintool"));
			expect(matches.some((m) => m.toLowerCase().endsWith(".cmd"))).toBe(true);
		}),
	);
});

describe("IoUtil.which", () => {
	it.effect("returns Option.some(firstMatch) when found", () =>
		Effect.gen(function* () {
			const a = writeExecutable(dirA, "mytool");
			process.env.PATH = dirA;
			const result = yield* runFs(IoUtil.which("mytool"));
			expect(Option.isSome(result)).toBe(true);
			if (Option.isSome(result)) {
				expect(result.value).toBe(a);
			}
		}),
	);

	it.effect("returns Option.none() when not found", () =>
		Effect.gen(function* () {
			process.env.PATH = dirA;
			const result = yield* runFs(IoUtil.which("nope-not-here"));
			expect(Option.isNone(result)).toBe(true);
		}),
	);

	it.effect("returns the first PATH match when a tool exists in two directories", () =>
		Effect.gen(function* () {
			const a = writeExecutable(dirA, "dup");
			writeExecutable(dirB, "dup");
			// dirA first → its match wins.
			process.env.PATH = [dirA, dirB].join(delimiter);
			const result = yield* runFs(IoUtil.which("dup"));
			expect(Option.isSome(result)).toBe(true);
			if (Option.isSome(result)) {
				expect(result.value).toBe(a);
			}
		}),
	);
});

describe("IoUtil.whichOrFail", () => {
	it.effect("succeeds with the path when found", () =>
		Effect.gen(function* () {
			const a = writeExecutable(dirA, "mytool");
			process.env.PATH = dirA;
			const result = yield* runFs(IoUtil.whichOrFail("mytool"));
			expect(result).toBe(a);
		}),
	);

	it.effect("fails with IoError when not found", () =>
		Effect.gen(function* () {
			process.env.PATH = dirA;
			const exit = yield* runFsExit(IoUtil.whichOrFail("nope-not-here"));
			expect(Exit.isFailure(exit)).toBe(true);
			if (Exit.isFailure(exit)) {
				const cause = JSON.stringify(exit.cause);
				expect(cause).toContain("IoError");
				expect(cause).toContain("nope-not-here");
			}
		}),
	);
});

describe("IoUtil executable check", () => {
	it.effect.skipIf(isWindows)("ignores a non-executable file on POSIX", () =>
		Effect.gen(function* () {
			const filePath = join(dirA, "notexec");
			writeFileSync(filePath, "plain data\n");
			chmodSync(filePath, 0o644);
			process.env.PATH = dirA;

			const matches = yield* runFs(IoUtil.findInPath("notexec"));
			expect(matches).toEqual([]);

			const which = yield* runFs(IoUtil.which("notexec"));
			expect(Option.isNone(which)).toBe(true);
		}),
	);

	it.effect.skipIf(isWindows)("finds an executable file on POSIX (execute bit set)", () =>
		Effect.gen(function* () {
			const a = writeExecutable(dirA, "execme");
			process.env.PATH = dirA;
			const matches = yield* runFs(IoUtil.findInPath("execme"));
			expect(matches).toEqual([a]);
		}),
	);
});
