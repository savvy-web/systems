import { NodeServices } from "@effect/platform-node";
import { beforeEach, describe, expect, it, vi } from "@effect/vitest";
import type { CliUiTestSession } from "@effected/cli/ui/testing";
import { CliUiTest } from "@effected/cli/ui/testing";
import { MemoryFileSystem } from "@effected/memfs";
import { Lint } from "@savvy-web/silk-effects";
import { Console, Effect, Fiber, FileSystem } from "effect";
import { Command } from "effect/cli";

import { confirmForce, forceTargets, initFailure, lintPresetOption, runInit } from "../src/commands/init.js";
import { CommandError } from "../src/internal/command-error.js";
import { Capture } from "./utils/capture.js";
import { Interactive } from "./utils/interactive.js";

beforeEach(() => {
	vi.spyOn(console, "log").mockImplementation(() => {});
	vi.spyOn(console, "info").mockImplementation(() => {});
	vi.spyOn(console, "warn").mockImplementation(() => {});
	vi.spyOn(console, "error").mockImplementation(() => {});
	vi.spyOn(console, "debug").mockImplementation(() => {});
});

describe("savvy init orchestrator", () => {
	it.effect("runs changeset, commit, and lint init in order and succeeds", () =>
		Effect.gen(function* () {
			const calls: string[] = [];
			yield* runInit({
				changeset: Effect.sync(() => calls.push("changeset")),
				commit: Effect.sync(() => calls.push("commit")),
				lint: Effect.sync(() => calls.push("lint")),
			});
			expect(calls).toEqual(["changeset", "commit", "lint"]);
		}),
	);

	it.effect("short-circuits: stops at the first failing step", () =>
		Effect.gen(function* () {
			const calls: string[] = [];
			// `Effect.flip` proves the step's error reaches the TYPED channel.
			const error = yield* Effect.flip(
				runInit({
					changeset: Effect.sync(() => calls.push("changeset")),
					commit: Effect.fail(new Error("commit failed")),
					lint: Effect.sync(() => calls.push("lint")),
				}),
			);
			expect(error).toBeInstanceOf(Error);
			expect(error.message).toBe("commit failed");
			expect(calls).toEqual(["changeset"]); // lint never runs
		}),
	);
});

// ---------------------------------------------------------------------------
// --force confirmation
// ---------------------------------------------------------------------------

const targets = forceTargets({
	commitConfig: "lib/configs/commitlint.config.ts",
	lintConfig: "lib/configs/lint-staged.config.ts",
	lintPreset: "silk",
});

/** A volume holding `files` (relative paths resolve from the volume root). */
const volume = (files: ReadonlyArray<string>) =>
	MemoryFileSystem.layerWith(Object.fromEntries(files.map((f) => [`/${f}`, "original\n"])));

describe("forceTargets", () => {
	it("lists the managed markdownlint config only for the silk preset", () => {
		expect(targets).toContain(Lint.MARKDOWNLINT_CONFIG_PATH);
		expect(forceTargets({ commitConfig: "c.ts", lintConfig: "l.ts", lintPreset: "minimal" })).not.toContain(
			Lint.MARKDOWNLINT_CONFIG_PATH,
		);
		expect(targets).toEqual(
			expect.arrayContaining([".husky/commit-msg", ".husky/pre-commit", ".changeset/config.json"]),
		);
	});
});

describe("confirmForce", () => {
	it.effect("asks when --force would overwrite, and a yes proceeds", () =>
		Effect.gen(function* () {
			const { session, fiber } = yield* Interactive.run(
				confirmForce({ force: true, yes: false, targets }).pipe(Effect.provide(volume([".husky/commit-msg"]))),
			);
			const screen = yield* session.next({ contains: "Overwrite 1 existing file(s)" });
			expect(yield* screen.plainFrame).toContain(".husky/commit-msg");
			yield* screen.type("y");
			yield* screen.press("enter");
			const result = yield* Fiber.join(fiber);
			expect(result.value).toBe(true);
			expect(result.stdout).toEqual([]);
		}).pipe(Effect.scoped),
	);

	it.effect("a no answers false, says nothing changed, and leaves the files untouched", () =>
		Effect.gen(function* () {
			const existing = [".husky/commit-msg", "lib/configs/lint-staged.config.ts"];
			const { session, fiber } = yield* Interactive.run(
				Effect.gen(function* () {
					const calls: Array<string> = [];
					const write = (step: string) =>
						Effect.flatMap(FileSystem.FileSystem, (fs) =>
							Effect.andThen(
								Effect.sync(() => calls.push(step)),
								fs.writeFileString(".husky/commit-msg", "overwritten\n"),
							),
						);
					// The handler's shape: confirm, then run the steps only on a yes.
					if (yield* confirmForce({ force: true, yes: false, targets })) {
						yield* runInit({ changeset: write("changeset"), commit: write("commit"), lint: write("lint") });
					}
					const fs = yield* FileSystem.FileSystem;
					return { calls, contents: yield* fs.readFileString(".husky/commit-msg") };
				}).pipe(Effect.provide(volume(existing))),
			);
			const screen = yield* session.next({ contains: "Overwrite 2 existing file(s)" });
			yield* screen.press("enter"); // Enter alone answers no
			const result = yield* Fiber.join(fiber);
			expect(result.value).toEqual({ calls: [], contents: "original\n" });
			expect(result.stdout).toEqual(["↷ Nothing changed: existing files kept"]);
		}).pipe(Effect.scoped),
	);

	it.effect("never asks when nothing would be overwritten, without --force, or with --yes", () =>
		Effect.gen(function* () {
			for (const [opts, files] of [
				[{ force: true, yes: false }, []],
				[{ force: false, yes: false }, [".husky/commit-msg"]],
				[{ force: true, yes: true }, [".husky/commit-msg"]],
			] as const) {
				yield* Effect.scoped(
					Effect.gen(function* () {
						const { session, fiber } = yield* Interactive.run(
							confirmForce({ ...opts, targets }).pipe(Effect.provide(volume(files))),
						);
						const result = yield* Fiber.join(fiber);
						expect(result.value).toBe(true);
						expect(yield* session.mounts).toBe(0);
					}),
				);
			}
		}),
	);

	it.effect("a run that cannot prompt proceeds as init --force always has, mounting nothing", () =>
		Effect.gen(function* () {
			const { session, fiber } = yield* Interactive.run(
				confirmForce({ force: true, yes: false, targets }).pipe(Effect.provide(volume([".husky/commit-msg"]))),
				{ interactive: false },
			);
			const result = yield* Fiber.join(fiber);
			expect(result.value).toBe(true);
			expect(result.stdout).toEqual([]);
			expect(yield* session.mounts).toBe(0);
		}).pipe(Effect.scoped),
	);
});

// ---------------------------------------------------------------------------
// --lint-preset
// ---------------------------------------------------------------------------

/** A command carrying the shipped `--lint-preset` flag, printing what it parsed. */
const presetProbe = Command.make("probe", { lintPreset: lintPresetOption }, ({ lintPreset }) =>
	Console.log(`preset=${lintPreset}`),
);

const runProbe = (session: CliUiTestSession, args: ReadonlyArray<string>) =>
	Command.runWith(presetProbe, { version: "0.0.0" })(args).pipe(
		Effect.provide(session.layer),
		Effect.provide(NodeServices.layer),
	);

describe("--lint-preset", () => {
	it.effect("omitted at a terminal, asks with a Select starting on silk", () =>
		Effect.gen(function* () {
			const session = yield* CliUiTest.session({ color: "none" });
			const fiber = yield* Effect.forkScoped(runProbe(session, []));
			const screen = yield* session.next({ contains: "Which lint-staged preset?" });
			yield* screen.press("down", "enter");
			yield* Fiber.join(fiber);
			expect(yield* session.stdout).toBe("preset=standard\n");
			expect(yield* session.mounts).toBe(1);
		}).pipe(Effect.scoped),
	);

	it.effect("omitted where nobody can answer, is silk and mounts nothing", () =>
		Effect.gen(function* () {
			const session = yield* CliUiTest.session({ interactive: false });
			yield* runProbe(session, []);
			expect(yield* session.stdout).toBe("preset=silk\n");
			expect(yield* session.mounts).toBe(0);
		}).pipe(Effect.scoped),
	);

	it.effect("given, is used without asking", () =>
		Effect.gen(function* () {
			const session = yield* CliUiTest.session();
			yield* runProbe(session, ["--lint-preset", "minimal"]);
			expect(yield* session.stdout).toBe("preset=minimal\n");
			expect(yield* session.mounts).toBe(0);
		}).pipe(Effect.scoped),
	);
});

// ---------------------------------------------------------------------------
// Failure report
// ---------------------------------------------------------------------------

describe("initFailure", () => {
	it("passes a CommandError a step raised through unchanged", () => {
		const own = new CommandError({ message: "mine" });
		expect(initFailure(own)).toBe(own);
	});

	it.effect("draws a step's foreign failure with a hint on stderr and exits 1", () =>
		Effect.gen(function* () {
			const result = yield* Capture.main(
				runInit({
					changeset: Effect.void,
					commit: Effect.fail(new Error("EACCES: .husky/commit-msg")),
					lint: Effect.void,
				}).pipe(Effect.mapError(initFailure)),
			);
			expect(result.exitCode).toBe(1);
			const stderr = result.stderr.join("\n");
			expect(stderr).toContain("✗ savvy init stopped before finishing");
			expect(stderr).toContain("EACCES: .husky/commit-msg");
			expect(stderr).toContain("re-run savvy init");
			expect(result.stdout).toEqual([]);
		}),
	);
});
