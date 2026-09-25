/**
 * The built `savvy` bin over a real process boundary, spawned hermetically by
 * `@effected/cli/testing`'s `CliTest`: the `--version` line and the usage-error
 * exit code are what `CliRuntime.main` owns, and neither is visible from a
 * handler test.
 */

import { resolve } from "node:path";
import { NodeServices } from "@effect/platform-node";
import { describe, expect, it } from "@effect/vitest";
import { CliTest } from "@effected/cli/testing";
import { Effect } from "effect";

const BIN = resolve(import.meta.dirname, "..", "..", "dist", "dev", "pkg", "bin", "savvy.js");

const run = (args: ReadonlyArray<string>) =>
	Effect.gen(function* () {
		const sandbox = yield* CliTest.sandbox({ path: process.env.PATH ?? "" });
		return yield* CliTest.run(BIN, args, { sandbox, execPath: process.execPath });
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

	// Core's `Command.runWith` prints the subcommand's help on stdout and the parse
	// error on stderr; `@effected/cli` offers no switch to move the help. The
	// contract pinned here is exactly that: exit 64, the error only on stderr,
	// and nothing on stdout but the help text.
	it.effect("a usage error exits 64 with the error on stderr and only help on stdout", () =>
		Effect.gen(function* () {
			const result = yield* run(["lint", "--definitely-not-a-flag"]);
			expect(result.exitCode).toBe(64);
			expect(result.stderr).toContain("Unrecognized flag: --definitely-not-a-flag");
			expect(result.stdout).not.toContain("definitely-not-a-flag");
			expect(result.stdout.trimStart().startsWith("DESCRIPTION")).toBe(true);
			expect(result.stdout).toContain("USAGE\n  savvy lint");
		}),
	);
});
