/**
 * The built `savvy` bin over a real process boundary, spawned hermetically by
 * `@effected/cli/testing`'s `CliTest`: the `--version` line, the usage-error
 * exit code and where help goes are what `CliRuntime.main` owns, and none is
 * visible from a handler test.
 */

import { resolve } from "node:path";
import { NodeServices } from "@effect/platform-node";
import { describe, expect, it } from "@effect/vitest";
import { CliTest } from "@effected/cli/testing";
import { Effect } from "effect";

const BIN = resolve(import.meta.dirname, "..", "..", "dist", "dev", "pkg", "bin", "savvy.js");

/**
 * `FORCE_COLOR=0` is pinned: colour follows Node, so a `FORCE_COLOR` inherited
 * from CI would otherwise paint output these assertions read as plain text.
 */
const run = (args: ReadonlyArray<string>, env: Readonly<Record<string, string>> = {}) =>
	Effect.gen(function* () {
		const sandbox = yield* CliTest.sandbox({ path: process.env.PATH ?? "" });
		return yield* CliTest.run(BIN, args, {
			sandbox,
			execPath: process.execPath,
			env: { FORCE_COLOR: "0", ...env },
		});
	}).pipe(Effect.scoped, Effect.provide(NodeServices.layer));

describe("savvy bin (dist/dev)", () => {
	it.effect("--version prints one bare line on stdout for a direct install", () =>
		Effect.gen(function* () {
			const result = yield* run(["--version"]);
			expect(result.exitCode).toBe(0);
			expect(result.stdout.trim()).toMatch(/^savvy v\d+\.\d+\.\d+$/);
			expect(result.stderr).toBe("");
		}),
	);

	// `CliRuntime.main`'s `helpOnUsageError: "stderr"` moves the help that core's
	// `Command.runWith` prints with a parse error off stdout, beside the error: a
	// caller that parses stdout (a hook piping JSON, a monitor's `JSON.parse`)
	// sees nothing there on a usage error.
	it.effect("a usage error exits 64 with the error and the help on stderr, and nothing on stdout", () =>
		Effect.gen(function* () {
			const result = yield* run(["lint", "--definitely-not-a-flag"]);
			expect(result.exitCode).toBe(64);
			expect(result.stdout).toBe("");
			expect(result.stderr).toContain("Unrecognized flag: --definitely-not-a-flag");
			expect(result.stderr).toContain("USAGE\n  savvy lint");
		}),
	);

	it.effect("an unknown subcommand is a usage error with clean stdout too", () =>
		Effect.gen(function* () {
			const result = yield* run(["definitely-not-a-command"]);
			expect(result.exitCode).toBe(64);
			expect(result.stdout).toBe("");
			expect(result.stderr).toContain("USAGE");
		}),
	);

	// Neither an explicit `--help` nor a bare group invocation is an error, so
	// help stays on stdout and the run exits 0.
	it.effect("an explicit --help prints help on stdout and exits 0", () =>
		Effect.gen(function* () {
			const result = yield* run(["lint", "--help"]);
			expect(result.exitCode).toBe(0);
			expect(result.stdout).toContain("USAGE\n  savvy lint");
			expect(result.stderr).toBe("");
		}),
	);

	it.effect("a bare group invocation prints its help on stdout and exits 0", () =>
		Effect.gen(function* () {
			const result = yield* run(["lint"]);
			expect(result.exitCode).toBe(0);
			expect(result.stdout).toContain("USAGE\n  savvy lint");
			expect(result.stderr).toBe("");
		}),
	);

	// `CliAudience.run` resolves the audience flags before core parses, on any
	// command, and `--help` lists them beside core's built-in flags.
	it.effect("accepts an audience flag on any command and lists the flags in help", () =>
		Effect.gen(function* () {
			const result = yield* run(["lint", "--agent", "--help"]);
			expect(result.exitCode).toBe(0);
			expect(result.stdout).toContain("--audience");
			expect(result.stdout).toContain("--agent");
			expect(result.stderr).toBe("");
		}),
	);

	it.effect("more than one audience flag is a usage error with clean stdout", () =>
		Effect.gen(function* () {
			const result = yield* run(["--human", "--agent", "lint"]);
			expect(result.exitCode).toBe(64);
			expect(result.stdout).toBe("");
		}),
	);

	it.effect("an invalid SAVVY_AUDIENCE warns and is ignored, never failing the run", () =>
		Effect.gen(function* () {
			const result = yield* run(["--version"], { SAVVY_AUDIENCE: "robot" });
			expect(result.exitCode).toBe(0);
			expect(result.stdout.trim()).toMatch(/^savvy v\d+\.\d+\.\d+$/);
		}),
	);
});
