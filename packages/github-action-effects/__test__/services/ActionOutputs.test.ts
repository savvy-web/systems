import { describe, expect, it } from "@effect/vitest";
import { Effect, Schema } from "effect";
import { ActionOutputsTest } from "../../src/layers/ActionOutputsTest.js";
import { ActionOutputs } from "../../src/services/ActionOutputs.js";

// -- Service method shorthand (eliminates repeated pipe+flatMap boilerplate) --

const use = <A, E>(fn: (svc: Effect.Success<typeof ActionOutputs>) => Effect.Effect<A, E>) =>
	Effect.flatMap(ActionOutputs, fn);

const runWithOutputs = <A, E>(effect: Effect.Effect<A, E, ActionOutputs>) => {
	const state = ActionOutputsTest.empty();
	return Effect.map(Effect.provide(effect, ActionOutputsTest.layer(state)), (result) => ({
		result,
		state,
	}));
};

describe("ActionOutputs", () => {
	describe("set", () => {
		it.effect("captures a string output", () =>
			Effect.gen(function* () {
				const { state } = yield* runWithOutputs(use((svc) => svc.set("result", "success")));
				expect(state.outputs).toEqual([{ name: "result", value: "success" }]);
			}),
		);
	});

	describe("setJson", () => {
		const MySchema = Schema.Struct({
			count: Schema.Number,
			label: Schema.String,
		});

		it.effect("serializes and captures JSON output", () =>
			Effect.gen(function* () {
				const { state } = yield* runWithOutputs(
					use((svc) => svc.setJson("data", { count: 42, label: "test" }, MySchema)),
				);
				expect(state.outputs).toHaveLength(1);
				const first = state.outputs[0];
				expect(first).toBeDefined();
				expect(JSON.parse(first?.value ?? "")).toEqual({
					count: 42,
					label: "test",
				});
			}),
		);
	});

	describe("summary", () => {
		it.effect("captures summary content", () =>
			Effect.gen(function* () {
				const { state } = yield* runWithOutputs(use((svc) => svc.summary("## Build Report\n\nAll good.")));
				expect(state.summaries).toEqual(["## Build Report\n\nAll good."]);
			}),
		);
	});

	describe("exportVariable", () => {
		it.effect("captures exported variables", () =>
			Effect.gen(function* () {
				const { state } = yield* runWithOutputs(use((svc) => svc.exportVariable("MY_VAR", "value")));
				expect(state.variables).toEqual([{ name: "MY_VAR", value: "value" }]);
			}),
		);
	});

	describe("addPath", () => {
		it.effect("captures added paths", () =>
			Effect.gen(function* () {
				const { state } = yield* runWithOutputs(use((svc) => svc.addPath("/usr/local/bin")));
				expect(state.paths).toEqual(["/usr/local/bin"]);
			}),
		);
	});

	describe("setFailed", () => {
		it.effect("captures failure message", () =>
			Effect.gen(function* () {
				const { state } = yield* runWithOutputs(use((svc) => svc.setFailed("Something went wrong")));
				expect(state.failed).toEqual(["Something went wrong"]);
			}),
		);
	});

	describe("setSecret", () => {
		it.effect("captures secret value", () =>
			Effect.gen(function* () {
				const { state } = yield* runWithOutputs(use((svc) => svc.setSecret("ghs_abc123")));
				expect(state.secrets).toEqual(["ghs_abc123"]);
			}),
		);
	});
});
