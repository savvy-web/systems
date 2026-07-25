import { describe, expect, it } from "@effect/vitest";
import { Cause, Effect, Exit, Option, Schema } from "effect";
import { CommandRunnerError } from "../../src/errors/CommandRunnerError.js";
import type { CommandResponse } from "../../src/layers/CommandRunnerTest.js";
import { CommandRunnerTest } from "../../src/layers/CommandRunnerTest.js";
import { CommandRunner } from "../../src/services/CommandRunner.js";

// -- Shared provide helper --

const provide = <A, E>(responses: ReadonlyMap<string, CommandResponse>, effect: Effect.Effect<A, E, CommandRunner>) =>
	Effect.provide(effect, CommandRunnerTest.layer(responses));

const run = <A, E>(responses: ReadonlyMap<string, CommandResponse>, effect: Effect.Effect<A, E, CommandRunner>) =>
	provide(responses, effect);

const runExit = <A, E>(responses: ReadonlyMap<string, CommandResponse>, effect: Effect.Effect<A, E, CommandRunner>) =>
	Effect.exit(provide(responses, effect));

const runEmpty = <A, E>(effect: Effect.Effect<A, E, CommandRunner>) =>
	Effect.provide(effect, CommandRunnerTest.empty());

// -- Service method shorthands --

const exec = (command: string, args?: ReadonlyArray<string>) =>
	Effect.flatMap(CommandRunner, (svc) => svc.exec(command, args));

const execCapture = (command: string, args?: ReadonlyArray<string>) =>
	Effect.flatMap(CommandRunner, (svc) => svc.execCapture(command, args));

const execJson = <A, I>(command: string, args: ReadonlyArray<string> | undefined, schema: Schema.Codec<A, I>) =>
	Effect.flatMap(CommandRunner, (svc) => svc.execJson(command, args, schema));

const execLines = (command: string, args?: ReadonlyArray<string>) =>
	Effect.flatMap(CommandRunner, (svc) => svc.execLines(command, args));

// -- Helper to build response maps --

const responses = (...entries: [string, CommandResponse][]): ReadonlyMap<string, CommandResponse> => new Map(entries);

describe("CommandRunner", () => {
	describe("exec", () => {
		it.effect("returns 0 for successful command", () =>
			Effect.gen(function* () {
				const result = yield* runEmpty(exec("echo", ["hello"]));
				expect(result).toBe(0);
			}),
		);

		it.effect("fails with CommandRunnerError on non-zero exit code", () =>
			Effect.gen(function* () {
				const exit = yield* runExit(
					responses(["git status", { exitCode: 128, stdout: "", stderr: "fatal: not a git repo" }]),
					exec("git", ["status"]),
				);
				expect(exit._tag).toBe("Failure");
				if (Exit.isFailure(exit)) {
					const error = Option.getOrUndefined(Cause.findErrorOption(exit.cause));
					expect(error).toBeInstanceOf(CommandRunnerError);
					if (error instanceof CommandRunnerError) {
						expect(error.exitCode).toBe(128);
						expect(error.stderr).toBe("fatal: not a git repo");
					}
				}
			}),
		);
	});

	describe("execCapture", () => {
		it.effect("captures stdout and stderr", () =>
			Effect.gen(function* () {
				const result = yield* run(
					responses(["ls -la", { exitCode: 0, stdout: "file1\nfile2\n", stderr: "" }]),
					execCapture("ls", ["-la"]),
				);
				expect(result.exitCode).toBe(0);
				expect(result.stdout).toBe("file1\nfile2\n");
				expect(result.stderr).toBe("");
			}),
		);

		it.effect("fails on non-zero exit code", () =>
			Effect.gen(function* () {
				const exit = yield* runExit(
					responses(["npm install", { exitCode: 1, stdout: "", stderr: "ERR!" }]),
					execCapture("npm", ["install"]),
				);
				expect(exit._tag).toBe("Failure");
			}),
		);
	});

	describe("execJson", () => {
		const PackageInfo = Schema.Struct({
			name: Schema.String,
			version: Schema.String,
		});

		it.effect("parses and validates JSON stdout", () =>
			Effect.gen(function* () {
				const jsonOutput = JSON.stringify({ name: "my-pkg", version: "1.0.0" });
				const result = yield* run(
					responses(["npm info", { exitCode: 0, stdout: jsonOutput, stderr: "" }]),
					execJson("npm", ["info"], PackageInfo),
				);
				expect(result).toEqual({ name: "my-pkg", version: "1.0.0" });
			}),
		);

		it.effect("fails on invalid JSON", () =>
			Effect.gen(function* () {
				const exit = yield* runExit(
					responses(["npm info", { exitCode: 0, stdout: "not json", stderr: "" }]),
					execJson("npm", ["info"], PackageInfo),
				);
				expect(exit._tag).toBe("Failure");
			}),
		);

		it.effect("fails when JSON does not match schema", () =>
			Effect.gen(function* () {
				const exit = yield* runExit(
					responses(["npm info", { exitCode: 0, stdout: JSON.stringify({ wrong: "shape" }), stderr: "" }]),
					execJson("npm", ["info"], PackageInfo),
				);
				expect(exit._tag).toBe("Failure");
			}),
		);

		it.effect("fails on non-zero exit code before parsing", () =>
			Effect.gen(function* () {
				const exit = yield* runExit(
					responses(["npm info", { exitCode: 1, stdout: "", stderr: "not found" }]),
					execJson("npm", ["info"], PackageInfo),
				);
				expect(exit._tag).toBe("Failure");
			}),
		);
	});

	describe("execLines", () => {
		it.effect("splits stdout into trimmed non-empty lines", () =>
			Effect.gen(function* () {
				const result = yield* run(
					responses(["git branch", { exitCode: 0, stdout: "  main\n  feature/foo\n  fix/bar\n", stderr: "" }]),
					execLines("git", ["branch"]),
				);
				expect(result).toEqual(["main", "feature/foo", "fix/bar"]);
			}),
		);

		it.effect("filters blank lines", () =>
			Effect.gen(function* () {
				const result = yield* run(
					responses(["echo", { exitCode: 0, stdout: "line1\n\n\nline2\n", stderr: "" }]),
					execLines("echo"),
				);
				expect(result).toEqual(["line1", "line2"]);
			}),
		);

		it.effect("returns empty array for empty stdout", () =>
			Effect.gen(function* () {
				const result = yield* runEmpty(execLines("true"));
				expect(result).toEqual([]);
			}),
		);
	});

	describe("CommandRunnerError", () => {
		it("is a tagged error with correct fields", () => {
			const error = new CommandRunnerError({
				command: "npm",
				args: ["install"],
				exitCode: 1,
				stderr: "ERR!",
				reason: "Command failed",
			});
			expect(error._tag).toBe("CommandRunnerError");
			expect(error.command).toBe("npm");
			expect(error.args).toEqual(["install"]);
			expect(error.exitCode).toBe(1);
			expect(error.stderr).toBe("ERR!");
			expect(error.reason).toBe("Command failed");
		});
	});

	describe("test layer lookup", () => {
		it.effect("matches exact command+args key", () =>
			Effect.gen(function* () {
				const result = yield* run(
					responses(
						["git", { exitCode: 0, stdout: "fallback", stderr: "" }],
						["git status", { exitCode: 0, stdout: "specific", stderr: "" }],
					),
					execCapture("git", ["status"]),
				);
				expect(result.stdout).toBe("specific");
			}),
		);

		it.effect("falls back to command-only key", () =>
			Effect.gen(function* () {
				const result = yield* run(
					responses(["git", { exitCode: 0, stdout: "fallback", stderr: "" }]),
					execCapture("git", ["log", "--oneline"]),
				);
				expect(result.stdout).toBe("fallback");
			}),
		);

		it.effect("defaults to empty success when no match", () =>
			Effect.gen(function* () {
				const result = yield* runEmpty(execCapture("unknown-cmd"));
				expect(result.exitCode).toBe(0);
				expect(result.stdout).toBe("");
				expect(result.stderr).toBe("");
			}),
		);
	});
});
