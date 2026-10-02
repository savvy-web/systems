import { describe, expect, it } from "@effect/vitest";
import { Doc } from "@effected/cli";
import { Effect } from "effect";
import { runCheck } from "../src/commands/check.js";
import type { CheckSection } from "../src/commands/check-section.js";
import { Report } from "../src/internal/report.js";
import { Capture } from "./utils/capture.js";

const section = (title: string, verdict: CheckSection["verdict"], text: string): CheckSection => ({
	title,
	verdict,
	fixedByInit: verdict === "failure",
	blocks: [verdict === "failure" ? Report.fail(text) : Report.ok(text)],
});

const clean = {
	changeset: Effect.succeed(section("changesets", "success", "All changeset files passed validation")),
	commit: Effect.succeed(section("commitlint", "success", "Config file: commitlint.config.ts")),
	lint: Effect.succeed(section("lint-staged", "success", "Config file: lint-staged.config.ts")),
};

/** Every stdout line, the documents split into the lines a reader sees. */
const lines = (stdout: ReadonlyArray<string>) => stdout.flatMap((write) => write.split("\n"));

describe("savvy check orchestrator", () => {
	it.effect("prints all three tools as one document, and exits 0 when clean", () =>
		Effect.gen(function* () {
			const result = yield* Capture.run(runCheck(clean));
			expect(result.exitCode).toBe(0);
			expect(result.stdout).toHaveLength(1);
			expect(lines(result.stdout)).toEqual([
				"changesets",
				"  ✓ All changeset files passed validation",
				"",
				"commitlint",
				"  ✓ Config file: commitlint.config.ts",
				"",
				"lint-staged",
				"  ✓ Config file: lint-staged.config.ts",
				"",
				"3 ok",
			]);
		}),
	);

	it.effect("a commit or lint finding sets exit 1, counts it, and tips savvy init", () =>
		Effect.gen(function* () {
			const result = yield* Capture.run(
				runCheck({
					...clean,
					commit: Effect.succeed(section("commitlint", "failure", "No commitlint config file found")),
				}),
			);
			expect(result.exitCode).toBe(1);
			const out = lines(result.stdout);
			expect(out).toContain("  ✗ No commitlint config file found");
			expect(out).toContain("2 ok, 1 failed");
			expect(out.at(-1)).toBe("TIP: run savvy init to install or update the missing pieces");
		}),
	);

	it.effect("a changeset finding counts as failed and keeps its exit code, with no savvy init tip", () =>
		Effect.gen(function* () {
			const result = yield* Capture.run(
				runCheck({
					...clean,
					changeset: Effect.succeed({
						...section("changesets", "failure", "1 file(s) with errors"),
						fixedByInit: false,
					}),
				}),
			);
			expect(result.exitCode).toBe(1);
			const out = lines(result.stdout);
			expect(out.at(-1)).toBe("2 ok, 1 failed");
			expect(out.join("\n")).not.toContain("TIP:");
		}),
	);

	it.effect("an advisory-only section is a warning: counted, but exit 0", () =>
		Effect.gen(function* () {
			const result = yield* Capture.run(
				runCheck({ ...clean, lint: Effect.succeed(section("lint-staged", "warning", "rules differ")) }),
			);
			expect(result.exitCode).toBe(0);
			expect(lines(result.stdout).at(-1)).toBe("2 ok, 1 warning");
		}),
	);

	it.effect("folds each tool into a ::group:: under GitHub Actions; a plain CI log does not", () =>
		Effect.gen(function* () {
			const actions = lines((yield* Capture.run(runCheck(clean), { audience: "ci", githubActions: true })).stdout);
			expect(actions).toContain("::group::changesets");
			expect(actions).toContain("::group::commitlint");
			expect(actions).toContain("::group::lint-staged");
			expect(actions.filter((line) => line === "::endgroup::")).toHaveLength(3);

			const agent = lines((yield* Capture.run(runCheck(clean), { audience: "agent" })).stdout);
			expect(agent.join("\n")).not.toContain("::group::");
			expect(agent).toContain("commitlint");
		}),
	);

	it.effect("writes a section's top-level annotations inside its group under GitHub Actions", () =>
		Effect.gen(function* () {
			const changeset = {
				...section("changesets", "failure", "1 file(s) with errors"),
				fixedByInit: false,
				blocks: [
					Doc.annotation({ level: "error", file: ".changeset/a.md", line: 3, col: 1 }, "CSH001 bad heading"),
					Report.fail("1 file(s) with errors"),
				],
			};
			const run = runCheck({ ...clean, changeset: Effect.succeed(changeset) });
			const actions = lines((yield* Capture.run(run, { audience: "ci", githubActions: true })).stdout);
			const group = actions.indexOf("::group::changesets");
			expect(actions[group + 1]).toBe("::error file=.changeset/a.md,line=3,col=1::CSH001 bad heading");
			// Control: off Actions an annotation writes nothing.
			const agent = lines((yield* Capture.run(run, { audience: "agent" })).stdout);
			expect(agent.join("\n")).not.toContain("CSH001");
		}),
	);

	it.effect("an empty section (a clean --quiet lint) is left out of the document", () =>
		Effect.gen(function* () {
			const result = yield* Capture.run(
				runCheck({ ...clean, lint: Effect.succeed({ ...section("lint-staged", "success", ""), blocks: [] }) }),
			);
			expect(lines(result.stdout)).not.toContain("lint-staged");
			expect(lines(result.stdout).at(-1)).toBe("3 ok");
		}),
	);

	it.effect("runs ALL checks even when one fails, then re-raises the failure", () =>
		Effect.gen(function* () {
			const calls: string[] = [];
			// `Effect.flip` (not `Effect.exit`) proves the failure arrives through
			// the TYPED error channel — a defect would not satisfy it.
			const error = yield* Effect.flip(
				Capture.run(
					runCheck({
						changeset: Effect.sync(() => calls.push("changeset")).pipe(
							Effect.as(section("changesets", "success", "ok")),
						),
						commit: Effect.fail(new Error("commit check failed")),
						lint: Effect.sync(() => calls.push("lint")).pipe(
							Effect.as(section("lint-staged", "success", "Config file: x")),
						),
					}),
				),
			);
			expect(error.message).toBe("commit check failed");
			expect(calls).toEqual(["changeset", "lint"]);
		}),
	);
});
