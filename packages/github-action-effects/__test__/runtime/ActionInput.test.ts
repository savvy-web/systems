import { afterEach, beforeEach, describe, expect, it } from "@effect/vitest";
import { Cause, Config, ConfigProvider, Effect, Option } from "effect";
import { ActionInput } from "../../src/runtime/ActionInput.js";
import { ActionsConfigProvider } from "../../src/runtime/ActionsConfigProvider.js";

const run = <A>(config: Config.Config<A>) => Effect.provide(config, ConfigProvider.layer(ActionsConfigProvider));

const runExit = <A>(config: Config.Config<A>) =>
	Effect.exit(Effect.provide(config, ConfigProvider.layer(ActionsConfigProvider)));

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

describe("ActionInput.boolean (YAML 1.2 Core Schema)", () => {
	it.effect("accepts 'true' → true", () =>
		Effect.gen(function* () {
			setEnv("INPUT_FLAG", "true");
			expect(yield* run(ActionInput.boolean("flag"))).toBe(true);
		}),
	);

	it.effect("accepts 'True' → true", () =>
		Effect.gen(function* () {
			setEnv("INPUT_FLAG", "True");
			expect(yield* run(ActionInput.boolean("flag"))).toBe(true);
		}),
	);

	it.effect("accepts 'TRUE' → true", () =>
		Effect.gen(function* () {
			setEnv("INPUT_FLAG", "TRUE");
			expect(yield* run(ActionInput.boolean("flag"))).toBe(true);
		}),
	);

	it.effect("accepts 'false' → false", () =>
		Effect.gen(function* () {
			setEnv("INPUT_FLAG", "false");
			expect(yield* run(ActionInput.boolean("flag"))).toBe(false);
		}),
	);

	it.effect("accepts 'False' → false", () =>
		Effect.gen(function* () {
			setEnv("INPUT_FLAG", "False");
			expect(yield* run(ActionInput.boolean("flag"))).toBe(false);
		}),
	);

	it.effect("accepts 'FALSE' → false", () =>
		Effect.gen(function* () {
			setEnv("INPUT_FLAG", "FALSE");
			expect(yield* run(ActionInput.boolean("flag"))).toBe(false);
		}),
	);

	it.effect("tolerates surrounding whitespace (toolkit trims before the check)", () =>
		Effect.gen(function* () {
			setEnv("INPUT_FLAG", "  true  ");
			expect(yield* run(ActionInput.boolean("flag"))).toBe(true);
		}),
	);

	const expectInvalidData = (value: string) =>
		Effect.gen(function* () {
			setEnv("INPUT_FLAG", value);
			const exit = yield* runExit(ActionInput.boolean("flag"));
			expect(exit._tag).toBe("Failure");
			const maybeError = exit._tag === "Failure" ? Cause.findErrorOption(exit.cause) : Option.none();
			if (Option.isSome(maybeError)) {
				expect(maybeError.value).toBeInstanceOf(Config.ConfigError);
			} else {
				throw new Error(`expected a Fail cause, got ${JSON.stringify(exit)}`);
			}
		});

	it.effect("rejects 'yes' with ConfigError.InvalidData", () => expectInvalidData("yes"));
	it.effect("rejects 'on' with ConfigError.InvalidData", () => expectInvalidData("on"));
	it.effect("rejects '1' with ConfigError.InvalidData", () => expectInvalidData("1"));
	it.effect("rejects '0' with ConfigError.InvalidData", () => expectInvalidData("0"));
	it.effect("rejects 'no' with ConfigError.InvalidData", () => expectInvalidData("no"));
	it.effect("rejects 'off' with ConfigError.InvalidData", () => expectInvalidData("off"));
	it.effect("rejects 'tRue' (mixed case) with ConfigError.InvalidData", () => expectInvalidData("tRue"));

	it.effect("error message cites the YAML 1.2 Core Schema list", () =>
		Effect.gen(function* () {
			setEnv("INPUT_FLAG", "yes");
			const exit = yield* runExit(ActionInput.boolean("flag"));
			expect(exit._tag).toBe("Failure");
			const maybeMsgError = exit._tag === "Failure" ? Cause.findErrorOption(exit.cause) : Option.none();
			if (Option.isSome(maybeMsgError)) {
				const message = (maybeMsgError.value as Config.ConfigError).message;
				expect(message).toContain("Input does not meet YAML 1.2");
				expect(message).toContain("Core Schema");
				expect(message).toContain("true | True | TRUE | false | False | FALSE");
			} else {
				throw new Error("expected a Fail cause");
			}
		}),
	);

	it.effect("composes with Config.withDefault when input is unset", () =>
		Effect.gen(function* () {
			delete process.env.INPUT_FLAG;
			const result = yield* run(Config.withDefault(ActionInput.boolean("flag"), false));
			expect(result).toBe(false);
		}),
	);
});

describe("ActionInput.multiline", () => {
	it.effect("splits on newlines", () =>
		Effect.gen(function* () {
			setEnv("INPUT_PATHS", "a\nb\nc");
			expect(yield* run(ActionInput.multiline("paths"))).toEqual(["a", "b", "c"]);
		}),
	);

	it.effect("drops empty lines", () =>
		Effect.gen(function* () {
			setEnv("INPUT_PATHS", "a\n\nb\n");
			expect(yield* run(ActionInput.multiline("paths"))).toEqual(["a", "b"]);
		}),
	);

	it.effect("trims each line", () =>
		Effect.gen(function* () {
			setEnv("INPUT_PATHS", "  a  \n b ");
			expect(yield* run(ActionInput.multiline("paths"))).toEqual(["a", "b"]);
		}),
	);

	it.effect("returns single-element array for single line", () =>
		Effect.gen(function* () {
			setEnv("INPUT_PATHS", "solo");
			expect(yield* run(ActionInput.multiline("paths"))).toEqual(["solo"]);
		}),
	);

	it.effect("missing input is a ConfigError (not [])", () =>
		Effect.gen(function* () {
			delete process.env.INPUT_PATHS;
			const exit = yield* runExit(ActionInput.multiline("paths"));
			expect(exit._tag).toBe("Failure");
			const maybeMissing = exit._tag === "Failure" ? Cause.findErrorOption(exit.cause) : Option.none();
			if (Option.isSome(maybeMissing)) {
				expect(maybeMissing.value).toBeInstanceOf(Config.ConfigError);
			} else {
				throw new Error("expected a Fail cause");
			}
		}),
	);

	it.effect("composes with Config.withDefault to produce []", () =>
		Effect.gen(function* () {
			delete process.env.INPUT_PATHS;
			const result = yield* run(Config.withDefault(ActionInput.multiline("paths"), [] as ReadonlyArray<string>));
			expect(result).toEqual([]);
		}),
	);
});
