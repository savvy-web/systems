import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "@effect/vitest";
import { Config, Effect, References, Schema } from "effect";
import { HttpClient } from "effect/unstable/http";
import { ActionsRuntime } from "../../src/runtime/ActionsRuntime.js";
import { ActionLogger } from "../../src/services/ActionLogger.js";
import { ActionOutputs } from "../../src/services/ActionOutputs.js";
import { ActionState } from "../../src/services/ActionState.js";

// -- Helpers --

// `Effect.runPromise` wants `R: never` but `tsgo`'s narrowing of layer
// composition leaks `any` through `Effect.provide`. Cast at the seam so each
// call site doesn't carry the type-variance noise.
const run = <A>(effect: Effect.Effect<A, unknown, never> | Effect.Effect<A, unknown, unknown>) =>
	effect as Effect.Effect<A, unknown, never>;

const runWithDefault = <A, E, R>(effect: Effect.Effect<A, E, R>) =>
	// Cast is safe: ActionsRuntime.Default satisfies all R requirements in these tests.
	// Two casts because `tsgo` leaks `any` from the layer composition through both
	// the input effect's R-channel and the provided effect's R-channel.

	Effect.provide(effect as unknown as Effect.Effect<A, E, never>, ActionsRuntime.Default) as Effect.Effect<A, E, never>;

// Temp file management

let tempFiles: string[] = [];

const makeTempFile = (): string => {
	const filePath = path.join(os.tmpdir(), `actions-runtime-test-${Math.random().toString(36).slice(2)}`);
	fs.writeFileSync(filePath, "");
	tempFiles.push(filePath);
	return filePath;
};

// Env var cleanup

let envKeysSet: string[] = [];

const setEnv = (key: string, value: string) => {
	process.env[key] = value;
	envKeysSet.push(key);
};

const deleteEnv = (key: string) => {
	delete process.env[key];
	envKeysSet = envKeysSet.filter((k) => k !== key);
};

// -- Test Suite --

describe("ActionsRuntime", () => {
	let outputFile: string;
	let stateFile: string;
	let summaryFile: string;
	let envFile: string;
	let pathFile: string;
	let writeSpy: ReturnType<typeof vi.spyOn>;
	let captured: string[];

	beforeEach(() => {
		outputFile = makeTempFile();
		stateFile = makeTempFile();
		summaryFile = makeTempFile();
		envFile = makeTempFile();
		pathFile = makeTempFile();

		setEnv("GITHUB_OUTPUT", outputFile);
		setEnv("GITHUB_STATE", stateFile);
		setEnv("GITHUB_STEP_SUMMARY", summaryFile);
		setEnv("GITHUB_ENV", envFile);
		setEnv("GITHUB_PATH", pathFile);
		setEnv("GITHUB_REPOSITORY", "owner/repo");

		captured = [];
		writeSpy = vi.spyOn(process.stdout, "write").mockImplementation((chunk) => {
			captured.push(String(chunk));
			return true;
		});
	});

	afterEach(() => {
		writeSpy.mockRestore();

		for (const key of [...envKeysSet]) {
			delete process.env[key];
		}
		envKeysSet = [];

		for (const f of tempFiles) {
			try {
				fs.unlinkSync(f);
			} catch {
				// ignore cleanup errors
			}
		}
		tempFiles = [];
	});

	describe("ConfigProvider integration", () => {
		it.effect("reads INPUT_NAME when Config.string('name') is used", () =>
			Effect.gen(function* () {
				setEnv("INPUT_NAME", "my-action");

				const program = Config.string("name");
				const result = yield* runWithDefault(program);

				expect(result).toBe("my-action");

				deleteEnv("INPUT_NAME");
			}),
		);

		it.effect("returns an error when the input env var is missing", () =>
			Effect.gen(function* () {
				deleteEnv("INPUT_NAME");

				const program = Config.string("name");
				const exit = yield* run(Effect.exit(Effect.provide(program, ActionsRuntime.Default)));

				expect(exit._tag).toBe("Failure");
			}),
		);
	});

	describe("Logger integration", () => {
		it.effect("Effect.log emits plain text to stdout (Info level)", () =>
			Effect.gen(function* () {
				const program = Effect.log("hello from runtime");
				yield* runWithDefault(program);

				expect(captured.join("")).toContain("hello from runtime");
			}),
		);

		it.effect("Effect.logDebug emits ::debug:: workflow command when minimum log level is All", () =>
			Effect.gen(function* () {
				const program = Effect.logDebug("debug message").pipe(Effect.provideService(References.MinimumLogLevel, "All"));
				yield* runWithDefault(program);

				expect(captured.join("")).toContain("::debug::debug message");
			}),
		);

		it.effect("Effect.logWarning emits ::warning:: workflow command", () =>
			Effect.gen(function* () {
				const program = Effect.logWarning("warn message");
				yield* runWithDefault(program);

				expect(captured.join("")).toContain("::warning::warn message");
			}),
		);

		it.effect("Effect.logError emits ::error:: workflow command", () =>
			Effect.gen(function* () {
				const program = Effect.logError("error message");
				yield* runWithDefault(program);

				expect(captured.join("")).toContain("::error::error message");
			}),
		);
	});

	describe("ActionOutputs integration", () => {
		it.effect("set writes key=value to GITHUB_OUTPUT file", () =>
			Effect.gen(function* () {
				const program = Effect.flatMap(ActionOutputs, (svc) => svc.set("result", "success"));
				yield* runWithDefault(program);

				const content = fs.readFileSync(outputFile, "utf8");
				expect(content).toBe("result=success\n");
			}),
		);

		it.effect("setJson writes JSON-encoded value to GITHUB_OUTPUT file", () =>
			Effect.gen(function* () {
				const MySchema = Schema.Struct({ count: Schema.Number });
				const program = Effect.flatMap(ActionOutputs, (svc) => svc.setJson("data", { count: 42 }, MySchema));
				yield* runWithDefault(program);

				const content = fs.readFileSync(outputFile, "utf8");
				expect(content).toBe('data={"count":42}\n');
			}),
		);
	});

	describe("ActionState integration", () => {
		it.effect("save writes encoded state to GITHUB_STATE file", () =>
			Effect.gen(function* () {
				const MySchema = Schema.Struct({ token: Schema.String });
				const program = Effect.flatMap(ActionState, (svc) => svc.save("auth", { token: "abc" }, MySchema));
				yield* runWithDefault(program);

				const content = fs.readFileSync(stateFile, "utf8");
				expect(content).toBe(`auth=${JSON.stringify({ token: "abc" })}\n`);
			}),
		);

		it.effect("getOptional returns None when state env var is not set", () =>
			Effect.gen(function* () {
				const MySchema = Schema.Struct({ token: Schema.String });
				const program = Effect.flatMap(ActionState, (svc) => svc.getOptional("missing", MySchema));
				const result = yield* runWithDefault(program);

				expect(result._tag).toBe("None");
			}),
		);
	});

	describe("ActionLogger integration", () => {
		it.effect("group emits ::group:: and ::endgroup:: workflow commands", () =>
			Effect.gen(function* () {
				const program = Effect.flatMap(ActionLogger, (logger) => logger.group("my-group", Effect.void));
				yield* runWithDefault(program);

				const output = captured.join("");
				expect(output).toContain("::group::my-group");
				expect(output).toContain("::endgroup::");
			}),
		);
	});

	describe("HttpClient integration", () => {
		it.effect(
			"provides HttpClient.HttpClient so Oidc/GitHubApp/ActionCache resolve through ActionsRuntime.Default",
			() =>
				Effect.gen(function* () {
					// Resolving the HttpClient service confirms FetchHttpClient.layer is
					// merged into the common path; the migrated layers depend on it.
					const client = yield* runWithDefault(Effect.map(HttpClient.HttpClient, (c) => c));
					expect(client).toBeDefined();
					expect(typeof client.execute).toBe("function");
				}),
		);
	});
});
