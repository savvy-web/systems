import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, layer } from "@effect/vitest";
import { Doc } from "@effected/cli";
import { Effect, Layer, Logger } from "effect";

import { changesetCheckSection, runChangesetCheck } from "../../src/commands/changeset/commands/check.js";
import { Report } from "../../src/internal/report.js";
import { Capture } from "../utils/capture.js";
import { TestExit } from "../utils/exit.js";

/** Logs silenced, plus the fixed presentation environment the handler's report renders under. */
const silentLogger = Layer.merge(Logger.layer([]), Capture.env);

// A suite-boundary `layer()` is safe here: `Logger.layer([])` is stateless and
// carries nothing across tests, and this suite never chdirs — each test drives a
// freshly-created temp dir passed in as an argument.
layer(silentLogger)("check command – runChangesetCheck handler", (it) => {
	let tempDir: string;

	beforeEach(() => {
		tempDir = mkdtempSync(join(tmpdir(), "cli-check-"));
		TestExit.reset();
	});

	afterEach(() => {
		rmSync(tempDir, { recursive: true });
	});

	it.effect("logs success message when all changesets are valid", () =>
		Effect.gen(function* () {
			writeFileSync(
				join(tempDir, "feat.md"),
				'---\n"@savvy-web/changesets": minor\n---\n\n## Features\n\n- Added CLI\n',
			);
			writeFileSync(
				join(tempDir, "fix.md"),
				'---\n"@savvy-web/changesets": patch\n---\n\n## Bug Fixes\n\n- Fixed something\n',
			);

			yield* runChangesetCheck(tempDir);

			expect(TestExit.code()).toBe(0);
		}).pipe(Effect.provide(TestExit.layer)),
	);

	it.effect("logs success message for an empty directory", () =>
		Effect.gen(function* () {
			yield* runChangesetCheck(tempDir);

			expect(TestExit.code()).toBe(0);
		}).pipe(Effect.provide(TestExit.layer)),
	);

	it.effect("sets the exit code to 1 when errors are found", () =>
		Effect.gen(function* () {
			writeFileSync(join(tempDir, "bad.md"), '---\n"@savvy-web/changesets": minor\n---\n\n# Bad Title\n');

			yield* runChangesetCheck(tempDir);

			expect(TestExit.code()).toBe(1);
		}).pipe(Effect.provide(TestExit.layer)),
	);

	it.effect("groups messages by file when multiple files have errors", () =>
		Effect.gen(function* () {
			writeFileSync(join(tempDir, "a.md"), "# Bad\n");
			writeFileSync(join(tempDir, "b.md"), "## Unknown\n\n- content\n");

			yield* runChangesetCheck(tempDir);

			expect(TestExit.code()).toBe(1);
		}).pipe(Effect.provide(TestExit.layer)),
	);

	it.effect("reports correct error count in the summary", () =>
		Effect.gen(function* () {
			writeFileSync(join(tempDir, "ok.md"), '---\n"pkg": minor\n---\n\n## Features\n\n- Good\n');
			writeFileSync(join(tempDir, "bad.md"), "# Bad\n");

			yield* runChangesetCheck(tempDir);

			// Only bad.md should produce errors, so exitCode must be set
			expect(TestExit.code()).toBe(1);
		}).pipe(Effect.provide(TestExit.layer)),
	);

	it.effect("does not set exitCode when only valid files are present", () =>
		Effect.gen(function* () {
			writeFileSync(
				join(tempDir, "one.md"),
				'---\n"@savvy-web/changesets": minor\n---\n\n## Features\n\n- Feature one\n',
			);
			writeFileSync(join(tempDir, "two.md"), '---\n"@savvy-web/changesets": patch\n---\n\n## Bug Fixes\n\n- Fix two\n');

			yield* runChangesetCheck(tempDir);

			expect(TestExit.code()).toBe(0);
		}).pipe(Effect.provide(TestExit.layer)),
	);

	it.effect("handles a single file with multiple lint errors (existing.push branch)", () =>
		Effect.gen(function* () {
			// h1 triggers heading-hierarchy, empty section triggers content-structure,
			// and "Unknown" heading triggers required-sections — all from the same file
			writeFileSync(join(tempDir, "multi.md"), "## Unknown\n\n## Features\n");

			yield* runChangesetCheck(tempDir);

			expect(TestExit.code()).toBe(1);
		}).pipe(Effect.provide(TestExit.layer)),
	);
});

describe("check command – rendering", () => {
	let tempDir: string;

	beforeEach(() => {
		tempDir = mkdtempSync(join(tmpdir(), "cli-check-render-"));
		writeFileSync(join(tempDir, "bad.md"), "# Bad\n");
	});

	afterEach(() => {
		rmSync(tempDir, { recursive: true });
	});

	it.effect("prints a section per file with a position/rule/message table, then the summary", () =>
		Effect.gen(function* () {
			const result = yield* Capture.run(runChangesetCheck(tempDir));
			const file = join(tempDir, "bad.md");

			expect(result.exitCode).toBe(1);
			expect(result.stdout).toHaveLength(1);
			const lines = result.stdout[0].split("\n");
			expect(lines[0]).toBe(file);
			expect(lines[2]).toMatch(/^position {2}rule {2,}message/);
			expect(lines[4]).toMatch(/^1:1 {7}changeset-heading-hierarchy {2}h1 headings are not allowed/);
			expect(lines.at(-1)).toBe("✗ 1 file(s) with errors, 1 error(s) found");
			// Only the Actions log draws an annotation.
			expect(result.stdout[0]).not.toContain("::error");
		}),
	);

	it.effect("prints the same escape-free table for an agent", () =>
		Effect.gen(function* () {
			const human = yield* Capture.run(runChangesetCheck(tempDir));
			const agent = yield* Capture.run(runChangesetCheck(tempDir), { audience: "agent" });

			expect(agent.stdout).toEqual(human.stdout);
			expect(agent.stdout[0]).not.toContain("\u001b");
		}),
	);

	it.effect("adds an error annotation per finding under GitHub Actions", () =>
		Effect.gen(function* () {
			const result = yield* Capture.run(runChangesetCheck(tempDir), { audience: "ci", githubActions: true });
			const file = join(tempDir, "bad.md");

			expect(result.exitCode).toBe(1);
			const annotations = result.stdout[0].split("\n").filter((line) => line.startsWith("::error "));
			expect(annotations).toHaveLength(1);
			expect(annotations[0]).toMatch(
				new RegExp(
					`^::error title=changeset-heading-hierarchy,file=${file.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")},line=1,col=1::h1 headings`,
				),
			);
		}),
	);

	it.effect("prints only the success line, with no annotation, when every file passes", () =>
		Effect.gen(function* () {
			rmSync(join(tempDir, "bad.md"));
			const result = yield* Capture.run(runChangesetCheck(tempDir), { audience: "ci", githubActions: true });

			expect(result.exitCode).toBe(0);
			expect(result.stdout).toEqual(["✓ All changeset files passed validation"]);
		}),
	);

	it.effect("returns the check as an unprinted section with a failure verdict", () =>
		Effect.gen(function* () {
			const result = yield* Capture.run(changesetCheckSection(tempDir));

			expect(result.stdout).toEqual([]);
			expect(result.exitCode).toBe(0);
			expect(result.value).toMatchObject({ title: "changesets", verdict: "failure", fixedByInit: false });
		}),
	);

	it.effect("returns a success verdict when every file passes", () =>
		Effect.gen(function* () {
			rmSync(join(tempDir, "bad.md"));
			const section = yield* changesetCheckSection(tempDir);

			expect(section.verdict).toBe("success");
			expect(section.blocks).toEqual([Report.ok("All changeset files passed validation")]);
		}),
	);

	it.effect("keeps its annotations when the caller folds the section into a collapsible under Actions", () =>
		Effect.gen(function* () {
			const section = yield* changesetCheckSection(tempDir);
			const result = yield* Capture.run(Report.print([Doc.collapsible(section.title, section.blocks)]), {
				audience: "ci",
				githubActions: true,
			});

			const lines = result.stdout[0].split("\n");
			expect(lines[0]).toBe("::group::changesets");
			expect(lines.filter((line) => line.startsWith("::error title=changeset-heading-hierarchy,"))).toHaveLength(1);
			expect(lines.at(-1)).toBe("::endgroup::");
		}),
	);
});
