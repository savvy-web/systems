/**
 * Source-text boundaries for the CLI front end. Exit codes go through
 * `CliExit` — `CliRuntime.main` owns the process exit — so no source file may
 * write `process.exitCode` or call `process.exit`. Reads of `process` are
 * ratcheted: the files that make one today are listed, and a new file that
 * starts reading the process fails this test until it is added deliberately.
 */

import { join } from "node:path";
import { NodeServices } from "@effect/platform-node";
import { describe, expect, it } from "@effect/vitest";
import { SourceBoundary } from "@effected/workspaces/testing";
import { Effect, FileSystem } from "effect";

const SRC = join(import.meta.dirname, "../src");

/** An assignment to `process.exitCode` or a call of `process.exit`, after comments are blanked. */
const EXIT_WRITE = /\bprocess\s*\.\s*(?:exitCode\s*=[^=]|exit\s*\()/;

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

	it.effect("no source file writes process.exitCode or calls process.exit", () =>
		Effect.gen(function* () {
			const fs = yield* FileSystem.FileSystem;
			const scan = yield* SourceBoundary.scan({ root: SRC, rules: ["process"] });
			expect(scan.files.length).toBeGreaterThan(20);
			const offenders: Array<string> = [];
			for (const file of scan.files) {
				const code = SourceBoundary.stripComments(yield* fs.readFileString(join(SRC, file)));
				if (EXIT_WRITE.test(code)) offenders.push(file);
			}
			expect(offenders).toEqual([]);
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
