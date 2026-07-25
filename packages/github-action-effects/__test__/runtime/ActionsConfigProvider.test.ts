import { afterEach, beforeEach, describe, expect, it } from "@effect/vitest";
import { Cause, Config, ConfigProvider, Effect, Option } from "effect";
import { ActionsConfigProvider } from "../../src/runtime/ActionsConfigProvider.js";

// Helper to run a Config (which extends Effect<A, ConfigError>) with ActionsConfigProvider installed
const run = <A>(config: Config.Config<A>) => Effect.provide(config, ConfigProvider.layer(ActionsConfigProvider));

const runExit = <A>(config: Config.Config<A>) =>
	Effect.exit(Effect.provide(config, ConfigProvider.layer(ActionsConfigProvider)));

// Track which env vars we set so we can clean up
let envKeysSet: string[] = [];

const setEnv = (key: string, value: string) => {
	process.env[key] = value;
	envKeysSet.push(key);
};

beforeEach(() => {
	envKeysSet = [];
});

afterEach(() => {
	for (const key of envKeysSet) {
		delete process.env[key];
	}
	envKeysSet = [];
});

describe("ActionsConfigProvider", () => {
	it.effect("reads INPUT_NAME for Config.string('name')", () =>
		Effect.gen(function* () {
			setEnv("INPUT_NAME", "my-action");
			const result = yield* run(Config.string("name"));
			expect(result).toBe("my-action");
		}),
	);

	it.effect("preserves hyphens: Config.string('retry-count') reads INPUT_RETRY-COUNT", () =>
		Effect.gen(function* () {
			setEnv("INPUT_RETRY-COUNT", "five");
			const result = yield* run(Config.string("retry-count"));
			expect(result).toBe("five");
		}),
	);

	it.effect("converts spaces to underscores: Config.string('my input') reads INPUT_MY_INPUT", () =>
		Effect.gen(function* () {
			setEnv("INPUT_MY_INPUT", "spaced-value");
			const result = yield* run(Config.string("my input"));
			expect(result).toBe("spaced-value");
		}),
	);

	it.effect("returns ConfigError when input is missing", () =>
		Effect.gen(function* () {
			delete process.env["INPUT_MISSING-THING"];
			const exit = yield* runExit(Config.string("missing-thing"));
			expect(exit._tag).toBe("Failure");
			if (exit._tag === "Failure") {
				const maybeError = Cause.findErrorOption(exit.cause);
				expect(Option.isSome(maybeError)).toBe(true);
				if (Option.isSome(maybeError)) {
					expect(maybeError.value).toBeInstanceOf(Config.ConfigError);
				}
			}
		}),
	);

	it.effect("treats empty string as missing and returns ConfigError", () =>
		Effect.gen(function* () {
			setEnv("INPUT_EMPTY-VAL", "");
			const exit = yield* runExit(Config.string("empty-val"));
			expect(exit._tag).toBe("Failure");
			if (exit._tag === "Failure") {
				const maybeError = Cause.findErrorOption(exit.cause);
				expect(Option.isSome(maybeError)).toBe(true);
				if (Option.isSome(maybeError)) {
					expect(maybeError.value).toBeInstanceOf(Config.ConfigError);
				}
			}
		}),
	);

	it.effect("returns fallback when input is missing and Config.withDefault is used", () =>
		Effect.gen(function* () {
			delete process.env.INPUT_OPTIONAL;
			const result = yield* run(Config.withDefault(Config.string("optional"), "fallback"));
			expect(result).toBe("fallback");
		}),
	);

	it.effect("reads and parses Config.boolean('verbose') from INPUT_VERBOSE", () =>
		Effect.gen(function* () {
			setEnv("INPUT_VERBOSE", "true");
			const result = yield* run(Config.boolean("verbose"));
			expect(result).toBe(true);
		}),
	);

	it.effect("reads and parses Config.int('count') from INPUT_COUNT", () =>
		Effect.gen(function* () {
			setEnv("INPUT_COUNT", "42");
			const result = yield* run(Config.int("count"));
			expect(result).toBe(42);
		}),
	);
});
