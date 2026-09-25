import { describe, expect, it } from "@effect/vitest";
import { CliExit } from "@effected/cli";
import { Console, Effect } from "effect";

import { Capture } from "./utils/capture.js";

describe("Capture", () => {
	it.effect("records Console.log on stdout", () =>
		Effect.gen(function* () {
			const result = yield* Capture.run(Console.log("a"));
			expect(result.stdout).toEqual(["a"]);
			expect(result.stderr).toEqual([]);
		}),
	);

	it.effect("routes every log line through the CLI logger to stderr, with no prefix", () =>
		Effect.gen(function* () {
			const result = yield* Capture.run(Effect.log("info line").pipe(Effect.andThen(Effect.logError("bad line"))));
			expect(result.stdout).toEqual([]);
			expect(result.stderr).toEqual(["info line", "bad line"]);
		}),
	);

	it.effect("reports the code a run set through CliExit, 0 when none", () =>
		Effect.gen(function* () {
			expect((yield* Capture.run(CliExit.set(1))).exitCode).toBe(1);
			expect((yield* Capture.run(Effect.void)).exitCode).toBe(0);
		}),
	);
});
