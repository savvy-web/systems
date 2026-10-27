// packages/bundler/__test__/runtime-env.test.ts
import { describe, expect, it } from "@effect/vitest";
import { ConfigProvider, Effect, Stdio } from "effect";
import { isCi, reportNoColor } from "../src/runtime-env.js";

describe("isCi", () => {
	it("is false for an empty environment and for CI=false", () => {
		expect(isCi({})).toBe(false);
		expect(isCi({ CI: "false" })).toBe(false);
	});

	it("is true for CI=true, CI=1 and a provider marker alone", () => {
		expect(isCi({ CI: "true" })).toBe(true);
		expect(isCi({ CI: "1" })).toBe(true);
		expect(isCi({ GITHUB_ACTIONS: "true" })).toBe(true);
		expect(isCi({ GITLAB_CI: "true" })).toBe(true);
	});
});

/** Decide the report's colour for an explicit environment and stdout TTY state. */
const noColorIn = (env: Record<string, string>, stdoutIsTerminal: boolean): Effect.Effect<boolean> =>
	reportNoColor.pipe(
		Effect.provide(Stdio.layerTest({ stdoutIsTerminal: Effect.succeed(stdoutIsTerminal) })),
		Effect.provide(ConfigProvider.layer(ConfigProvider.fromEnv({ env }))),
	);

describe("reportNoColor", () => {
	it.effect("a colour-capable TTY paints", () =>
		Effect.gen(function* () {
			expect(yield* noColorIn({ TERM: "xterm-256color" }, true)).toBe(false);
		}),
	);

	it.effect("a non-TTY stdout is plain", () =>
		Effect.gen(function* () {
			expect(yield* noColorIn({ TERM: "xterm-256color" }, false)).toBe(true);
		}),
	);

	it.effect("NO_COLOR turns a TTY plain", () =>
		Effect.gen(function* () {
			expect(yield* noColorIn({ TERM: "xterm-256color", NO_COLOR: "1" }, true)).toBe(true);
		}),
	);

	it.effect("FORCE_COLOR paints a non-TTY stdout and beats NO_COLOR", () =>
		Effect.gen(function* () {
			expect(yield* noColorIn({ FORCE_COLOR: "1" }, false)).toBe(false);
			expect(yield* noColorIn({ FORCE_COLOR: "1", NO_COLOR: "1" }, false)).toBe(false);
			expect(yield* noColorIn({ FORCE_COLOR: "0" }, true)).toBe(true);
		}),
	);

	it.effect("a TTY with no TERM/COLORTERM hint is plain (changed: the old rule painted every TTY)", () =>
		Effect.gen(function* () {
			expect(yield* noColorIn({}, true)).toBe(true);
		}),
	);
});
