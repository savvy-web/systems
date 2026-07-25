import { afterEach, beforeEach, describe, expect, it, vi } from "@effect/vitest";
import { Effect, Layer, Logger, References } from "effect";
import { ActionsLogger } from "../../src/runtime/ActionsLogger.js";

const ActionsLoggerLayer = Layer.merge(
	Logger.layer([ActionsLogger]),
	Layer.succeed(References.MinimumLogLevel, "Trace"),
);

const withActionsLogger = <A, E>(effect: Effect.Effect<A, E>) => Effect.provide(effect, ActionsLoggerLayer);

describe("ActionsLogger", () => {
	let writeSpy: ReturnType<typeof vi.spyOn>;
	let captured: string[];

	beforeEach(() => {
		captured = [];
		writeSpy = vi.spyOn(process.stdout, "write").mockImplementation((chunk) => {
			captured.push(String(chunk));
			return true;
		});
	});

	afterEach(() => {
		writeSpy.mockRestore();
	});

	it.effect("Effect.logDebug emits ::debug:: command", () =>
		Effect.gen(function* () {
			yield* withActionsLogger(Effect.logDebug("msg"));
			expect(captured.join("")).toContain("::debug::msg");
		}),
	);

	it.effect("Effect.logInfo emits plain text (no prefix)", () =>
		Effect.gen(function* () {
			yield* withActionsLogger(Effect.logInfo("msg"));
			const output = captured.join("");
			expect(output).toContain("msg");
			expect(output).not.toContain("::");
		}),
	);

	it.effect("Effect.logWarning emits ::warning:: command", () =>
		Effect.gen(function* () {
			yield* withActionsLogger(Effect.logWarning("msg"));
			expect(captured.join("")).toContain("::warning::msg");
		}),
	);

	it.effect("Effect.logError emits ::error:: command", () =>
		Effect.gen(function* () {
			yield* withActionsLogger(Effect.logError("msg"));
			expect(captured.join("")).toContain("::error::msg");
		}),
	);

	it.effect("Effect.logError with file and line annotations includes properties", () =>
		Effect.gen(function* () {
			yield* withActionsLogger(Effect.logError("msg").pipe(Effect.annotateLogs({ file: "a.ts", line: "1" })));
			expect(captured.join("")).toContain("::error file=a.ts,line=1::msg");
		}),
	);

	it.effect("messages with special chars are properly escaped", () =>
		Effect.gen(function* () {
			yield* withActionsLogger(Effect.logDebug("50% done\nend"));
			expect(captured.join("")).toContain("::debug::50%25 done%0Aend");
		}),
	);
});
