/**
 * Source-text boundaries for the CLI front end. Exit codes go through
 * `CliExit` — `CliRuntime.main` owns the process exit — so no source file may
 * touch `process.exitCode` or call `process.exit`. The build-time version
 * define is confined to `version.ts`. Reads of `process` are ratcheted: the
 * files that make one today are listed, and a new file that starts reading the
 * process fails this test until it is added deliberately.
 */

import { join } from "node:path";
import { NodeServices } from "@effect/platform-node";
import { describe, expect, it } from "@effect/vitest";
import { SourceBoundary } from "@effected/workspaces/testing";
import { Effect } from "effect";

const SRC = join(import.meta.dirname, "../src");

/** The files that read `process` today. Shrink this list; never grow it without a reason. */
const PROCESS_READERS: ReadonlyArray<string> = [
	"commands/changeset/commands/init.ts",
	"commands/changeset/commands/version.ts",
	"commands/commit/check.ts",
	"commands/commit/hooks/post-commit-verify.ts",
	"commands/commit/hooks/pre-commit-message.ts",
	"commands/commit/hooks/session-start.ts",
	"commands/commit/lint.ts",
	"commands/lint/check.ts",
	"commands/lint/init.ts",
];

describe("cli source boundaries", () => {
	it("the scanner still flags what it must and spares what it must", () => {
		expect(SourceBoundary.verifyFixtures()).toEqual([]);
	});

	it.effect("no source file touches process.exitCode or calls process.exit", () =>
		Effect.gen(function* () {
			const scan = yield* SourceBoundary.scan({
				root: SRC,
				rules: [{ forbidTokens: ["process.exit"] }],
			});
			expect(scan.files.length).toBeGreaterThan(20);
			expect(scan.violations).toEqual([]);
		}).pipe(Effect.provide(NodeServices.layer)),
	);

	it.effect("the build-time version define is read only in version.ts", () =>
		Effect.gen(function* () {
			const scan = yield* SourceBoundary.scan({
				root: SRC,
				rules: [{ forbidTokens: ["process.env.__PACKAGE_VERSION__"] }],
				allowRules: { forbidTokens: ["version.ts"] },
			});
			expect(scan.violations).toEqual([]);
			// Non-vacuity: the one read was scanned and waived, not missed.
			expect(scan.waived.map((offence) => `${offence.file} ${offence.detail}`)).toEqual([
				"version.ts process.env.__PACKAGE_VERSION__",
			]);
		}).pipe(Effect.provide(NodeServices.layer)),
	);

	it.effect("process reads stay in the files that make them today", () =>
		Effect.gen(function* () {
			const scan = yield* SourceBoundary.scan({ root: SRC, rules: ["process", "node:process"] });
			const readers = [...new Set(scan.offences.map((offence) => offence.file))].sort();
			expect(readers).toEqual(PROCESS_READERS);
		}).pipe(Effect.provide(NodeServices.layer)),
	);
});
