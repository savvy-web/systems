/**
 * The program-wide built-in flags `main()` installs through `CliConfigLive`:
 * core's `--wizard` is trimmed from help and from parsing, the rest stay.
 */

import { describe, expect, it } from "@effect/vitest";
import { CliAudience, CliExit } from "@effected/cli";
import { Effect, Layer } from "effect";

import { AppLive, CliConfigLive, CliPlatform, rootCommand } from "../src/cli/index.js";
import { Capture } from "./utils/capture.js";

/** Run the real root command with `argv`, as `main()` composes it (minus `CliRuntime.main`). */
const run = (argv: ReadonlyArray<string>, config: Layer.Layer<never>) =>
	Capture.run(
		CliAudience.runWith(rootCommand, { version: "0.0.0" })(argv).pipe(
			Effect.provide(Layer.merge(AppLive, config)),
			Effect.provide(CliPlatform),
		),
	);

describe("CliConfigLive", () => {
	it.effect("keeps --help, --version, --completions and --log-level in help", () =>
		Effect.gen(function* () {
			const help = (yield* run(["--help"], CliConfigLive)).stdout.join("\n");
			for (const flag of ["--help", "--version", "--completions", "--log-level"]) {
				expect(help).toContain(flag);
			}
		}),
	);

	it.effect("drops core's --wizard from help", () =>
		Effect.gen(function* () {
			const help = (yield* run(["--help"], CliConfigLive)).stdout.join("\n");
			expect(help).not.toContain("--wizard");
			// Control: without the layer core lists it, so the assertion above can fail.
			const untrimmed = (yield* run(["--help"], Layer.empty)).stdout.join("\n");
			expect(untrimmed).toContain("--wizard");
		}),
	);

	it.effect("rejects --wizard as an unrecognized flag", () =>
		Effect.gen(function* () {
			const stdout: Array<string> = [];
			const stderr: Array<string> = [];
			const exit = yield* CliAudience.runWith(rootCommand, { version: "0.0.0" })(["--wizard"]).pipe(
				Effect.provide(Layer.merge(AppLive, CliConfigLive)),
				Effect.provide(CliPlatform),
				Effect.provide(Capture.layer(stdout, stderr)),
				Effect.provide(CliExit.layer),
				Effect.exit,
			);
			expect(exit._tag).toBe("Failure");
			expect([...stdout, ...stderr].join("\n")).toContain("Unrecognized flag: --wizard");
		}),
	);

	// Under `CliRuntime.main` the kit's own wizard gate also drops `--wizard`
	// from a run that cannot prompt, so only an INTERACTIVE run (a person at a
	// terminal) tells the trim apart from the gate.
	it.effect("keeps --wizard out of an interactive run under CliRuntime.main", () =>
		Effect.gen(function* () {
			const program = (config: Layer.Layer<never>) =>
				CliAudience.runWith(rootCommand, { version: "0.0.0" })(["--help"]).pipe(
					Effect.provide(Layer.merge(AppLive, config)),
					Effect.provide(CliPlatform),
				);
			const trimmed = yield* Capture.main(program(CliConfigLive), { tty: true });
			expect(trimmed.exitCode).toBe(0);
			expect(trimmed.stdout.join("\n")).toContain("--log-level");
			expect(trimmed.stdout.join("\n")).not.toContain("--wizard");
			const untrimmed = yield* Capture.main(program(Layer.empty), { tty: true });
			expect(untrimmed.stdout.join("\n")).toContain("--wizard");
			// And with `--human` given explicitly, the kit's restore does not bring it back.
			const human = yield* Capture.main(
				CliAudience.runWith(rootCommand, { version: "0.0.0" })(["--human", "--help"]).pipe(
					Effect.provide(Layer.merge(AppLive, CliConfigLive)),
					Effect.provide(CliPlatform),
				),
				{ tty: true },
			);
			expect(human.stdout.join("\n")).not.toContain("--wizard");
		}),
	);
});
