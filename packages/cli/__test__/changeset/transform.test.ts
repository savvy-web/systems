import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "@effect/vitest";
import { Changesets } from "@savvy-web/silk-effects";
import { Effect, Layer, Logger } from "effect";
import { driftReport, driftWindow, runTransform } from "../../src/commands/changeset/commands/transform.js";
import { Report } from "../../src/internal/report.js";
import { Capture } from "../utils/capture.js";
import { TestExit } from "../utils/exit.js";

const { ConfigurationError, ConfigInspector, makeConfigInspectorTest } = Changesets;

/** Logs silenced, plus the fixed presentation environment the handler's report renders under. */
const silentLogger = Layer.merge(Logger.layer([]), Capture.env);

// The tests below do not create a `.changeset/config.json` next to their
// CHANGELOG fixtures, so `requireValidConfig` short-circuits before
// invoking the inspector — but the type system still requires
// ConfigInspector to be provided. Stub it with a placeholder.
const StubInspectorLayer = makeConfigInspectorTest({
	configPath: "/stub/.changeset/config.json",
	projectDir: "/stub",
	changelog: null,
	baseBranch: "main",
	access: "restricted",
	ignore: [],
	packages: [],
	legacyVersionFilesUsed: false,
});

describe("transform command – runTransform handler", () => {
	let tempDir: string;

	beforeEach(() => {
		tempDir = mkdtempSync(join(tmpdir(), "cli-transform-"));
		TestExit.reset();
	});

	afterEach(() => {
		rmSync(tempDir, { recursive: true });
	});

	it.effect("writes transformed content to file in normal mode", () =>
		Effect.gen(function* () {
			const filePath = join(tempDir, "CHANGELOG.md");
			const input = "## 1.0.0\n\n### Bug Fixes\n\n- Fix A\n\n### Features\n\n- Feat A\n";
			writeFileSync(filePath, input);

			yield* runTransform(filePath, false, false).pipe(
				Effect.provide(StubInspectorLayer),
				Effect.provide(silentLogger),
			);

			const result = readFileSync(filePath, "utf-8");
			// Features should be reordered before Bug Fixes
			expect(result.indexOf("### Features")).toBeLessThan(result.indexOf("### Bug Fixes"));
		}).pipe(Effect.provide(TestExit.layer)),
	);

	it.effect("does not write to file in dry-run mode", () =>
		Effect.gen(function* () {
			const filePath = join(tempDir, "CHANGELOG.md");
			const input = "## 1.0.0\n\n### Bug Fixes\n\n- Fix A\n\n### Features\n\n- Feat A\n";
			writeFileSync(filePath, input);

			yield* runTransform(filePath, true, false).pipe(Effect.provide(StubInspectorLayer), Effect.provide(silentLogger));

			// File should remain unchanged
			const result = readFileSync(filePath, "utf-8");
			expect(result).toBe(input);
		}).pipe(Effect.provide(TestExit.layer)),
	);

	it.effect("sets the exit code to 1 in check mode when file would change", () =>
		Effect.gen(function* () {
			const filePath = join(tempDir, "CHANGELOG.md");
			// Sections in wrong order will be transformed
			const input = "## 1.0.0\n\n### Bug Fixes\n\n- Fix A\n\n### Features\n\n- Feat A\n";
			writeFileSync(filePath, input);

			yield* runTransform(filePath, false, true).pipe(Effect.provide(StubInspectorLayer), Effect.provide(silentLogger));

			expect(TestExit.code()).toBe(1);
			// File should NOT be written in check mode
			const result = readFileSync(filePath, "utf-8");
			expect(result).toBe(input);
		}).pipe(Effect.provide(TestExit.layer)),
	);

	it.effect("does not set exitCode in check mode when file is already formatted", () =>
		Effect.gen(function* () {
			const filePath = join(tempDir, "CHANGELOG.md");
			// First, produce already-formatted content by transforming once
			const raw = "## 1.0.0\n\n### Features\n\n- Feat A\n\n### Bug Fixes\n\n- Fix A\n";
			writeFileSync(filePath, raw);
			yield* runTransform(filePath, false, false).pipe(
				Effect.provide(StubInspectorLayer),
				Effect.provide(silentLogger),
			);
			const formatted = readFileSync(filePath, "utf-8");

			// Reset exitCode before check run
			TestExit.reset();

			// Now run in check mode against the already-formatted content
			writeFileSync(filePath, formatted);
			yield* runTransform(filePath, false, true).pipe(Effect.provide(StubInspectorLayer), Effect.provide(silentLogger));

			expect(TestExit.code()).toBe(0);
		}).pipe(Effect.provide(TestExit.layer)),
	);

	it.effect("rejects with an error when the file does not exist", () =>
		Effect.gen(function* () {
			const filePath = join(tempDir, "nonexistent.md");

			// `Effect.flip` is stronger than the old `.rejects.toThrow()`: that
			// assertion passed for a defect too, this one only passes if the
			// missing file surfaces through the TYPED error channel.
			const error = yield* Effect.flip(
				runTransform(filePath, false, false).pipe(Effect.provide(StubInspectorLayer), Effect.provide(silentLogger)),
			);
			// The read goes through `Effect.try`, so the missing file surfaces as
			// Cause.UnknownError — pinned by tag, not merely "something failed".
			expect(error._tag).toBe("UnknownError");
		}).pipe(Effect.provide(TestExit.layer)),
	);

	it.effect("resolves relative file paths", () =>
		Effect.gen(function* () {
			const filePath = join(tempDir, "CHANGELOG.md");
			const input = "## 1.0.0\n\n### Features\n\n- Added X\n";
			writeFileSync(filePath, input);

			// Pass the absolute path (which resolve will keep as-is)
			yield* runTransform(filePath, false, false).pipe(
				Effect.provide(StubInspectorLayer),
				Effect.provide(silentLogger),
			);

			const result = readFileSync(filePath, "utf-8");
			expect(result).toContain("### Features");
			expect(result).toContain("Added X");
		}).pipe(Effect.provide(TestExit.layer)),
	);

	it.effect("refuses to run when a config exists and the inspector returns ConfigurationError", () =>
		Effect.gen(function* () {
			// Place a config alongside the CHANGELOG so `requireValidConfig`
			// actually invokes the inspector. The inspector layer below always
			// fails — that should propagate as a Failure and set exitCode=1.
			const filePath = join(tempDir, "CHANGELOG.md");
			writeFileSync(filePath, "## 1.0.0\n\n### Features\n\n- X\n");
			mkdirSync(join(tempDir, ".changeset"), { recursive: true });
			writeFileSync(join(tempDir, ".changeset", "config.json"), "{}");

			const failingInspector = Layer.succeed(ConfigInspector, {
				inspect: () => Effect.fail(new ConfigurationError({ field: "options", reason: "synthetic" })),
				classify: () => Effect.fail(new ConfigurationError({ field: "options", reason: "synthetic" })),
				refresh: () => Effect.void,
				refreshIn: () => Effect.void,
			});

			const error = yield* Effect.flip(
				runTransform(filePath, false, false).pipe(Effect.provide(failingInspector), Effect.provide(silentLogger)),
			);
			expect(error._tag).toBe("CommandError");
			// File must not have been written.
			expect(readFileSync(filePath, "utf-8")).toBe("## 1.0.0\n\n### Features\n\n- X\n");

			// Through the runtime: the refusal draws itself on stderr and exits 1.
			const result = yield* Capture.main(runTransform(filePath, false, false).pipe(Effect.provide(failingInspector)));
			const stderr = result.stderr.join("\n").replace(/\s+/g, " ");
			expect(result.exitCode).toBe(1);
			expect(result.stdout).toEqual([]);
			expect(stderr).toContain(`✗ refusing to run: ${join(tempDir, ".changeset", "config.json")} is invalid`);
			expect(stderr).toContain("Configuration error (options): synthetic");
			expect(stderr).toContain("savvy changeset config validate");
		}).pipe(Effect.provide(TestExit.layer)),
	);

	it.effect("says so instead of drawing a diff when only the final line break differs", () =>
		Effect.gen(function* () {
			const filePath = join(tempDir, "CHANGELOG.md");
			writeFileSync(filePath, UNORDERED);
			const once = yield* Capture.run(runTransform(filePath, true, false).pipe(Effect.provide(StubInspectorLayer)));
			// The dry run prints the transformed text verbatim; strip its final line
			// break so the file differs from the transform's output only there.
			writeFileSync(filePath, once.stdout.join("\n").replace(/\n+$/, ""));

			const result = yield* Capture.run(runTransform(filePath, false, true).pipe(Effect.provide(StubInspectorLayer)));

			expect(result.exitCode).toBe(1);
			expect(result.stdout).toEqual([
				`⚠ ${filePath} would be modified by transform\n  only its final line break differs`,
			]);
		}),
	);

	it.effect("shows the drift as a diff under the finding in check mode", () =>
		Effect.gen(function* () {
			const filePath = join(tempDir, "CHANGELOG.md");
			writeFileSync(filePath, UNORDERED);

			const result = yield* Capture.run(runTransform(filePath, false, true).pipe(Effect.provide(StubInspectorLayer)));

			expect(result.exitCode).toBe(1);
			expect(result.stdout).toHaveLength(1);
			// Only the drifted lines (3-9 of 9), original then transformed, under
			// the finding. No unchanged context: `Doc.diff` would draw it as removed
			// and re-added.
			expect(result.stdout[0].split("\n")).toEqual([
				`⚠ ${filePath} would be modified by transform`,
				"  lines 3-9:",
				"- ### Bug Fixes",
				"-",
				"- - Fix A",
				"-",
				"- ### Features",
				"-",
				"- - Feat A",
				"+ ### Features",
				"+",
				"+ - Feat A",
				"+",
				"+ ### Bug Fixes",
				"+",
				"+ - Fix A",
			]);
		}),
	);

	it.effect("prints no diff in check mode when the file is already formatted", () =>
		Effect.gen(function* () {
			const filePath = join(tempDir, "CHANGELOG.md");
			writeFileSync(filePath, Changesets.ChangelogTransformer.transformContent(UNORDERED));

			const result = yield* Capture.run(runTransform(filePath, false, true).pipe(Effect.provide(StubInspectorLayer)));

			expect(result.exitCode).toBe(0);
			expect(result.stdout).toEqual([`✓ ${filePath} is already formatted`]);
		}),
	);

	it.effect("prints exactly the transformed text in dry-run mode, for every audience", () =>
		Effect.gen(function* () {
			const filePath = join(tempDir, "CHANGELOG.md");
			writeFileSync(filePath, UNORDERED);
			const expected = Changesets.ChangelogTransformer.transformContent(UNORDERED);

			for (const options of [{}, { audience: "agent" as const }, { audience: "ci" as const, githubActions: true }]) {
				const result = yield* Capture.run(
					runTransform(filePath, true, false).pipe(Effect.provide(StubInspectorLayer)),
					options,
				);
				// One document: the transformed text, which `Console.log` ends with a newline.
				expect(result.stdout).toEqual([expected.replace(/\n$/, "")]);
			}
		}),
	);

	describe("the drift report", () => {
		/** The `--check` finding for `original` → `transformed`, as printed lines. */
		const report = (original: string, transformed: string) =>
			Capture.run(Report.print(driftReport("CHANGELOG.md", driftWindow(original, transformed)))).pipe(
				Effect.map((result) => result.stdout.join("\n").split("\n")),
			);

		it.effect("says a blank-line insertion in words instead of drawing an empty diff", () =>
			Effect.gen(function* () {
				expect(yield* report("x\ny\n", "x\n\ny\n")).toEqual([
					"⚠ CHANGELOG.md would be modified by transform",
					"  inserts 1 blank line after line 1",
				]);
			}),
		);

		it.effect("says a blank-line deletion in words, naming the lines", () =>
			Effect.gen(function* () {
				expect(yield* report("x\n\n\ny\n", "x\ny\n")).toEqual([
					"⚠ CHANGELOG.md would be modified by transform",
					"  removes 2 blank lines at lines 2-3",
				]);
			}),
		);

		it.effect("lists a non-blank insertion's lines with no phantom removed line", () =>
			Effect.gen(function* () {
				expect(yield* report("# A\n", "# A\n\n- added\n")).toEqual([
					"⚠ CHANGELOG.md would be modified by transform",
					"  inserts 2 lines after line 1",
					"  +",
					"  + - added",
				]);
			}),
		);

		it.effect("names an insertion at the top of the file", () =>
			Effect.gen(function* () {
				expect((yield* report("x\n", "# Title\nx\n")).slice(0, 2)).toEqual([
					"⚠ CHANGELOG.md would be modified by transform",
					"  inserts 1 line at the top",
				]);
			}),
		);

		it.effect("still draws a replacement as a diff of only the changed lines", () =>
			Effect.gen(function* () {
				expect(yield* report("a\nold\nz\n", "a\nnew\nz\n")).toEqual([
					"⚠ CHANGELOG.md would be modified by transform",
					"  line 2:",
					"- old",
					"+ new",
				]);
			}),
		);
	});
});

/** A changelog whose sections are out of order, so the transform reorders them. */
const UNORDERED = "## 1.0.0\n\n### Bug Fixes\n\n- Fix A\n\n### Features\n\n- Feat A\n";
