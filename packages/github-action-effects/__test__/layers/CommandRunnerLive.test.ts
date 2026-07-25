import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { describe, expect, it } from "@effect/vitest";
import { Effect, Fiber, Metric, Schema } from "effect";
import { CommandRunnerLive, escapeWindowsArg } from "../../src/layers/CommandRunnerLive.js";
import { commandExecutions } from "../../src/runtime/Telemetry.js";
import { CommandRunner } from "../../src/services/CommandRunner.js";

const run = <A, E>(effect: Effect.Effect<A, E, CommandRunner>) => Effect.provide(effect, CommandRunnerLive);

const runExit = <A, E>(effect: Effect.Effect<A, E, CommandRunner>) =>
	Effect.exit(Effect.provide(effect, CommandRunnerLive));

describe("escapeWindowsArg", () => {
	it("returns the argument unchanged when it has no cmd.exe metacharacters", () => {
		expect(escapeWindowsArg("hello")).toBe("hello");
	});

	it("leaves interior backslashes alone when no quoting is needed", () => {
		expect(escapeWindowsArg("C:\\Users\\test")).toBe("C:\\Users\\test");
	});

	it("wraps an argument containing a space in double quotes", () => {
		expect(escapeWindowsArg("foo bar")).toBe('"foo bar"');
	});

	it("wraps an argument containing a metacharacter in double quotes", () => {
		expect(escapeWindowsArg("a&b")).toBe('"a&b"');
	});

	it("escapes a bare interior double quote", () => {
		expect(escapeWindowsArg('a"b')).toBe('"a\\"b"');
	});

	it("doubles a backslash run that precedes an interior quote, then escapes the quote", () => {
		// foo\"bar -> "foo\\\"bar" : 2 backslashes (doubled) + escaped quote
		expect(escapeWindowsArg('foo\\"bar')).toBe('"foo\\\\\\"bar"');
	});

	it("doubles a trailing backslash run so it is not read as an escaped closing quote", () => {
		// C:\path with space\ -> "C:\path with space\\" : trailing \ doubled before the closing quote
		expect(escapeWindowsArg("C:\\path with space\\")).toBe('"C:\\path with space\\\\"');
	});
});

describe("CommandRunnerLive", () => {
	describe("exec", () => {
		it.effect("runs a command and returns exit code 0", () =>
			Effect.gen(function* () {
				const result = yield* run(Effect.flatMap(CommandRunner, (svc) => svc.exec("echo", ["hello"])));
				expect(result).toBe(0);
			}),
		);

		it.effect("fails with CommandRunnerError on non-zero exit", () =>
			Effect.gen(function* () {
				const exit = yield* runExit(Effect.flatMap(CommandRunner, (svc) => svc.exec("sh", ["-c", "exit 1"])));
				expect(exit._tag).toBe("Failure");
			}),
		);

		it.effect("fails with CommandRunnerError for invalid command", () =>
			Effect.gen(function* () {
				const exit = yield* runExit(
					Effect.flatMap(CommandRunner, (svc) => svc.exec("this-command-does-not-exist-xyz")),
				);
				expect(exit._tag).toBe("Failure");
			}),
		);
	});

	describe("execCapture", () => {
		it.effect("captures stdout", () =>
			Effect.gen(function* () {
				const result = yield* run(Effect.flatMap(CommandRunner, (svc) => svc.execCapture("echo", ["hello"])));
				expect(result.exitCode).toBe(0);
				expect(result.stdout.trim()).toBe("hello");
			}),
		);

		it.effect("captures stderr", () =>
			Effect.gen(function* () {
				const result = yield* run(
					Effect.flatMap(CommandRunner, (svc) => svc.execCapture("sh", ["-c", "echo err >&2"])),
				);
				expect(result.exitCode).toBe(0);
				expect(result.stderr.trim()).toBe("err");
			}),
		);

		it.effect("fails with CommandRunnerError on non-zero exit", () =>
			Effect.gen(function* () {
				const exit = yield* runExit(
					Effect.flatMap(CommandRunner, (svc) => svc.execCapture("sh", ["-c", "echo fail >&2; exit 2"])),
				);
				expect(exit._tag).toBe("Failure");
				if (exit._tag === "Failure") {
					const error = exit.cause;
					// Verify it's a CommandRunnerError by checking the cause
					expect(String(error)).toContain("CommandRunnerError");
				}
			}),
		);
	});

	describe("execJson", () => {
		it.effect("parses JSON output", () =>
			Effect.gen(function* () {
				const MySchema = Schema.Struct({ name: Schema.String, version: Schema.String });
				const result = yield* run(
					Effect.flatMap(CommandRunner, (svc) => svc.execJson("echo", ['{"name":"test","version":"1.0.0"}'], MySchema)),
				);
				expect(result).toEqual({ name: "test", version: "1.0.0" });
			}),
		);

		it.effect("fails on invalid JSON stdout", () =>
			Effect.gen(function* () {
				const exit = yield* runExit(
					Effect.flatMap(CommandRunner, (svc) => svc.execJson("echo", ["not json"], Schema.String)),
				);
				expect(exit._tag).toBe("Failure");
			}),
		);

		it.effect("fails when schema does not match", () =>
			Effect.gen(function* () {
				const MySchema = Schema.Struct({ name: Schema.String });
				const exit = yield* runExit(
					Effect.flatMap(CommandRunner, (svc) => svc.execJson("echo", ['{"wrong":"shape"}'], MySchema)),
				);
				expect(exit._tag).toBe("Failure");
			}),
		);
	});

	describe("execLines", () => {
		it.effect("splits stdout into trimmed non-empty lines", () =>
			Effect.gen(function* () {
				const result = yield* run(
					Effect.flatMap(CommandRunner, (svc) => svc.execLines("printf", ["line1\\nline2\\nline3\\n"])),
				);
				expect(result).toEqual(["line1", "line2", "line3"]);
			}),
		);

		it.effect("filters blank lines and trims whitespace", () =>
			Effect.gen(function* () {
				const result = yield* run(
					Effect.flatMap(CommandRunner, (svc) =>
						svc.execLines("sh", ["-c", "echo '  line1  '; echo ''; echo '  line2  '"]),
					),
				);
				expect(result).toEqual(["line1", "line2"]);
			}),
		);
	});

	describe("options", () => {
		it.effect("respects cwd option", () =>
			Effect.gen(function* () {
				const tmpDir = fs.realpathSync(os.tmpdir());
				const result = yield* run(Effect.flatMap(CommandRunner, (svc) => svc.execCapture("pwd", [], { cwd: tmpDir })));
				expect(result.stdout.trim()).toBe(tmpDir);
			}),
		);

		it.effect("respects env option", () =>
			Effect.gen(function* () {
				const result = yield* run(
					Effect.flatMap(CommandRunner, (svc) =>
						svc.execCapture("sh", ["-c", "echo $MY_TEST_VAR"], {
							env: { MY_TEST_VAR: "hello-from-env" },
						}),
					),
				);
				expect(result.stdout.trim()).toBe("hello-from-env");
			}),
		);
	});

	describe("streaming", () => {
		it.effect("captures output while streaming to process.stdout/stderr", () =>
			Effect.gen(function* () {
				const result = yield* run(
					Effect.flatMap(CommandRunner, (svc) =>
						svc.execCapture("sh", ["-c", "echo streamed-out; echo streamed-err >&2"], { streaming: true }),
					),
				);
				expect(result.exitCode).toBe(0);
				expect(result.stdout.trim()).toBe("streamed-out");
				expect(result.stderr.trim()).toBe("streamed-err");
			}),
		);

		it.effect("still returns captured output when streaming is false", () =>
			Effect.gen(function* () {
				const result = yield* run(
					Effect.flatMap(CommandRunner, (svc) => svc.execCapture("echo", ["not-streamed"], { streaming: false })),
				);
				expect(result.stdout.trim()).toBe("not-streamed");
			}),
		);
	});

	describe("error shape", () => {
		it.effect("CommandRunnerError has correct fields", () =>
			Effect.gen(function* () {
				const exit = yield* runExit(Effect.flatMap(CommandRunner, (svc) => svc.exec("sh", ["-c", "exit 42"])));
				expect(exit._tag).toBe("Failure");
				if (exit._tag === "Failure") {
					// Extract error from cause
					const defect = exit.cause;
					const errStr = String(defect);
					expect(errStr).toContain("CommandRunnerError");
				}
			}),
		);
	});

	describe("interruption", () => {
		// `it.live`, not `it.effect`: this test spawns a real OS process and waits on real
		// wall-clock time (SIGTERM delivery, the child's boot). A frozen TestClock would
		// make every wait here a latent hang.
		it.live(
			"kills the child process when interrupted by timeout",
			() =>
				Effect.gen(function* () {
					const isAlive = (pid: number): boolean => {
						try {
							process.kill(pid, 0);
							return true;
						} catch {
							return false;
						}
					};

					// The child writes its own PID to a temp file the instant it boots,
					// then sleeps for a minute. We read the file after interrupting so we
					// can probe whether the finalizer actually killed the process.
					const pidFile = path.join(os.tmpdir(), `cmd-runner-pid-${Math.random().toString(36).slice(2)}`);
					const script = `require("node:fs").writeFileSync(${JSON.stringify(pidFile)}, String(process.pid)); setTimeout(() => {}, 60000)`;

					const fiber = yield* Effect.forkChild(
						Effect.flatMap(CommandRunner, (svc) => svc.exec("node", ["-e", script])).pipe(
							Effect.provide(CommandRunnerLive),
						),
					);
					// Poll until the child has booted and written its PID — robust to
					// scheduling jitter under the full (forks-pool) suite.
					yield* Effect.callback<void>((resume) => {
						const start = Date.now();
						const tick = setInterval(() => {
							if (fs.existsSync(pidFile) || Date.now() - start > 5000) {
								clearInterval(tick);
								resume(Effect.void);
							}
						}, 20);
					});
					yield* Fiber.interrupt(fiber);

					expect(fs.existsSync(pidFile)).toBe(true);
					const pid = Number(fs.readFileSync(pidFile, "utf8"));
					expect(Number.isInteger(pid)).toBe(true);

					// After the interruption finalizer ran the child must be reaped.
					// Poll because SIGTERM delivery is asynchronous.
					for (let i = 0; i < 50 && isAlive(pid); i++) {
						yield* Effect.sleep("20 millis");
					}
					expect(isAlive(pid)).toBe(false);

					fs.rmSync(pidFile, { force: true });
				}),
			10_000,
		);
	});

	describe("telemetry", () => {
		it.effect("increments the command-execution counter once per exec", () =>
			Effect.gen(function* () {
				// The counter is incremented on the per-command tagged variant, so the
				// snapshot must read the same tagged metric.
				const tagged = commandExecutions.pipe(Metric.withAttributes({ command: "echo" }));
				const before = yield* Metric.value(tagged);
				yield* run(Effect.flatMap(CommandRunner, (svc) => svc.exec("echo", ["one"])));
				yield* run(Effect.flatMap(CommandRunner, (svc) => svc.exec("echo", ["two"])));
				const after = yield* Metric.value(tagged);
				expect(after.count - before.count).toBe(2);
			}),
		);
	});
});
