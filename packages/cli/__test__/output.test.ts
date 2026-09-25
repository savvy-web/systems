import { describe, expect, it } from "@effect/vitest";
import type { Effect as EffectType } from "effect";
import { ConfigProvider, Effect, Layer, Stdio } from "effect";

import { Output } from "../src/internal/output.js";
import { Capture } from "./utils/capture.js";

/** A terminal (or not) with the given environment, so `CliColor.enabled` is decided by the test. */
const terminal = (options: { readonly tty: boolean; readonly env?: Record<string, string> }) =>
	Layer.merge(
		Stdio.layerTest({ stdoutIsTerminal: Effect.succeed(options.tty) }),
		ConfigProvider.layer(ConfigProvider.fromEnvRecord(options.env ?? {})),
	);

const piped = terminal({ tty: false });
const colourTerminal = terminal({ tty: true });

const capture = <E>(effect: EffectType.Effect<void, E, Stdio.Stdio>, layer = piped) =>
	Capture.run(effect).pipe(Effect.provide(layer));

describe("Output", () => {
	it.effect("prints each kind of line on stdout, none on stderr", () =>
		Effect.gen(function* () {
			const result = yield* capture(
				Effect.all([
					Output.ok("done"),
					Output.warn("careful"),
					Output.fail("broken"),
					Output.skip("absent"),
					Output.heading("Section"),
					Output.detail("more"),
					Output.line("raw"),
				]),
			);
			expect(result.stdout).toEqual(["✓ done", "⚠ careful", "✗ broken", "• absent", "Section", "  more", "raw"]);
			expect(result.stderr).toEqual([]);
		}),
	);

	it.effect("writes no ANSI escapes when stdout is piped", () =>
		Effect.gen(function* () {
			const result = yield* capture(
				Effect.all([
					Output.ok("a"),
					Output.warn("b"),
					Output.fail("c"),
					Output.skip("s"),
					Output.heading("d"),
					Output.detail("e"),
				]),
			);
			for (const line of result.stdout) expect(line).not.toContain("\u001b[");
		}),
	);

	it.effect("writes no ANSI escapes on a terminal when NO_COLOR is set", () =>
		Effect.gen(function* () {
			const result = yield* capture(Output.fail("c"), terminal({ tty: true, env: { NO_COLOR: "1" } }));
			expect(result.stdout).toEqual(["✗ c"]);
		}),
	);

	it.effect("colours the glyph on a terminal and resets after it", () =>
		Effect.gen(function* () {
			const result = yield* capture(Output.fail("c"), colourTerminal);
			expect(result.stdout).toEqual(["\u001b[31m✗\u001b[0m c"]);
		}),
	);

	it.effect("summarises counts, pluralising and omitting zeroes", () =>
		Effect.gen(function* () {
			const result = yield* capture(
				Effect.all([
					Output.summary({ ok: 3, warn: 1 }),
					Output.summary({ warn: 2, fail: 1 }),
					Output.summary({ ok: 0, fail: 0 }),
					Output.summary({}),
				]),
			);
			expect(result.stdout).toEqual(["3 ok · 1 warning", "2 warnings · 1 failed", "nothing to do", "nothing to do"]);
		}),
	);
});
