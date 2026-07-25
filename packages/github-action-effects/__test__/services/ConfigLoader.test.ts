import { describe, expect, it } from "@effect/vitest";
import { Effect, Schema } from "effect";
import type { ConfigLoaderError } from "../../src/errors/ConfigLoaderError.js";
import { ConfigLoaderTest } from "../../src/layers/ConfigLoaderTest.js";
import { ConfigLoader } from "../../src/services/ConfigLoader.js";

const TestConfig = Schema.Struct({
	name: Schema.String,
	version: Schema.Number,
});

const provide = <A, E>(state: ReturnType<typeof ConfigLoaderTest.empty>, effect: Effect.Effect<A, E, ConfigLoader>) =>
	Effect.provide(effect, ConfigLoaderTest.layer(state));

const run = <A, E>(state: ReturnType<typeof ConfigLoaderTest.empty>, effect: Effect.Effect<A, E, ConfigLoader>) =>
	provide(state, effect);

const runFail = <A>(
	state: ReturnType<typeof ConfigLoaderTest.empty>,
	effect: Effect.Effect<A, ConfigLoaderError, ConfigLoader>,
) => Effect.flip(provide(state, effect));

describe("ConfigLoader", () => {
	describe("loadJson", () => {
		it.effect("returns parsed and validated result", () =>
			Effect.gen(function* () {
				const state = ConfigLoaderTest.empty();
				state.files.set("/config.json", JSON.stringify({ name: "test", version: 1 }));

				const result = yield* run(
					state,
					Effect.flatMap(ConfigLoader, (svc) => svc.loadJson("/config.json", TestConfig)),
				);
				expect(result).toEqual({ name: "test", version: 1 });
			}),
		);

		it.effect("fails with validate error on schema mismatch", () =>
			Effect.gen(function* () {
				const state = ConfigLoaderTest.empty();
				state.files.set("/config.json", JSON.stringify({ name: "test", version: "not-a-number" }));

				const error = yield* runFail(
					state,
					Effect.flatMap(ConfigLoader, (svc) => svc.loadJson("/config.json", TestConfig)),
				);
				expect(error.operation).toBe("validate");
				expect(error.path).toBe("/config.json");
			}),
		);

		it.effect("fails with read error when file not found", () =>
			Effect.gen(function* () {
				const state = ConfigLoaderTest.empty();

				const error = yield* runFail(
					state,
					Effect.flatMap(ConfigLoader, (svc) => svc.loadJson("/missing.json", TestConfig)),
				);
				expect(error.operation).toBe("read");
				expect(error.path).toBe("/missing.json");
			}),
		);

		it.effect("fails with parse error on invalid JSON", () =>
			Effect.gen(function* () {
				const state = ConfigLoaderTest.empty();
				state.files.set("/bad.json", "{ invalid json }");

				const error = yield* runFail(
					state,
					Effect.flatMap(ConfigLoader, (svc) => svc.loadJson("/bad.json", TestConfig)),
				);
				expect(error.operation).toBe("parse");
				expect(error.path).toBe("/bad.json");
			}),
		);
	});

	describe("loadJsonc", () => {
		it.effect("returns parsed result with comments stripped", () =>
			Effect.gen(function* () {
				const state = ConfigLoaderTest.empty();
				state.files.set(
					"/config.jsonc",
					`{
	  // This is a comment
	  "name": "test",
	  "version": 2
	}`,
				);

				const result = yield* run(
					state,
					Effect.flatMap(ConfigLoader, (svc) => svc.loadJsonc("/config.jsonc", TestConfig)),
				);
				expect(result).toEqual({ name: "test", version: 2 });
			}),
		);
	});

	describe("loadYaml", () => {
		it.effect("returns parsed and validated result", () =>
			Effect.gen(function* () {
				const state = ConfigLoaderTest.empty();
				state.files.set("/config.yaml", "name: myapp\nversion: 3");

				const result = yield* run(
					state,
					Effect.flatMap(ConfigLoader, (svc) => svc.loadYaml("/config.yaml", TestConfig)),
				);
				expect(result).toEqual({ name: "myapp", version: 3 });
			}),
		);
	});

	describe("exists", () => {
		it.effect("returns true when file exists", () =>
			Effect.gen(function* () {
				const state = ConfigLoaderTest.empty();
				state.files.set("/config.json", "{}");

				const result = yield* run(
					state,
					Effect.flatMap(ConfigLoader, (svc) => svc.exists("/config.json")),
				);
				expect(result).toBe(true);
			}),
		);

		it.effect("returns false when file does not exist", () =>
			Effect.gen(function* () {
				const state = ConfigLoaderTest.empty();

				const result = yield* run(
					state,
					Effect.flatMap(ConfigLoader, (svc) => svc.exists("/missing.json")),
				);
				expect(result).toBe(false);
			}),
		);
	});
});
