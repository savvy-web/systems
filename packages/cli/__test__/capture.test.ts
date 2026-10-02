import { describe, expect, it } from "@effect/vitest";
import { CliExit, Doc } from "@effected/cli";
import { Audience } from "@effected/env";
import { Console, Effect } from "effect";

import { Report } from "../src/internal/report.js";
import { Capture } from "./utils/capture.js";

/** Prints the audience the run resolved, so a test sees which one a helper set. */
const printAudience = Effect.flatMap(Audience, (audience) => Console.log(audience.kind));

/** An annotation: one workflow command in the GitHub Actions log, nothing in any other renderer. */
const annotated = Report.print([
	Report.ok("lint"),
	Doc.annotation({ level: "error", file: "src/a.ts", line: 3 }, "boom"),
]);

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

	describe("audiences", () => {
		it.effect("runs as a person by default, and as the audience asked for", () =>
			Effect.gen(function* () {
				expect((yield* Capture.run(printAudience)).stdout).toEqual(["human"]);
				expect((yield* Capture.run(printAudience, { audience: "agent" })).stdout).toEqual(["agent"]);
				expect((yield* Capture.run(printAudience, { audience: "ci" })).stdout).toEqual(["ci"]);
			}),
		);

		it.effect("writes the GitHub Actions log format only for a ci audience under Actions", () =>
			Effect.gen(function* () {
				const actions = yield* Capture.run(annotated, { audience: "ci", githubActions: true });
				expect(actions.stdout.join("\n")).toContain("::error file=src/a.ts,line=3::boom");
				const plainCi = yield* Capture.run(annotated, { audience: "ci" });
				expect(plainCi.stdout.join("\n")).not.toContain("::error");
				expect(plainCi.stdout.join("\n")).toContain("lint");
			}),
		);

		it.effect("main resolves the audience from the override main() reads", () =>
			Effect.gen(function* () {
				expect((yield* Capture.main(printAudience)).stdout).toEqual(["human"]);
				expect((yield* Capture.main(printAudience, { audience: "agent" })).stdout).toEqual(["agent"]);
			}),
		);

		it.effect("main reports the CliExit code of a run that succeeds", () =>
			Effect.gen(function* () {
				expect((yield* Capture.main(CliExit.set(1))).exitCode).toBe(1);
				expect((yield* Capture.main(Effect.void)).exitCode).toBe(0);
			}),
		);
	});
});
