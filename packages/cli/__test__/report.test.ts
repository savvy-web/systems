import { describe, expect, it } from "@effect/vitest";
import { CliEnv, CliLinks } from "@effected/cli";
import type { Layer } from "effect";
import { Effect, Layer as L } from "effect";

import type { ReportEnv } from "../src/internal/report.js";
import { Report } from "../src/internal/report.js";
import { Capture } from "./utils/capture.js";

const ESC = "\u001b[";

/** `text` with its SGR escapes removed. */
const unpaint = (text: string): string => text.replaceAll(new RegExp(`${String.fromCharCode(27)}\\[[0-9;]*m`, "g"), "");

/** A presentation environment fixed for one test: who reads and what the terminal can do. */
const env = (options: Parameters<typeof CliEnv.layerTest>[0]): Layer.Layer<ReportEnv> =>
	L.merge(CliEnv.layerTest(options), CliLinks.layerTest("off"));

/** Print `doc` under `layer` and return stdout split into lines, plus stderr. */
const printed = (doc: Parameters<typeof Report.print>[0], layer?: Layer.Layer<ReportEnv>) =>
	Effect.gen(function* () {
		const print = layer === undefined ? Report.print(doc) : Report.print(doc).pipe(Effect.provide(layer));
		const result = yield* Capture.run(print);
		return { stdout: result.stdout.join("\n").split("\n"), stderr: result.stderr };
	});

describe("Report", () => {
	it.effect("renders each kind of block on stdout, none on stderr", () =>
		Effect.gen(function* () {
			const result = yield* printed([
				Report.heading("Section"),
				Report.ok("done"),
				Report.warn("careful"),
				Report.fail("broken"),
				Report.skip("absent"),
				Report.detail("more"),
				Report.line("raw"),
			]);
			expect(result.stdout).toEqual(["Section", "✓ done", "⚠ careful", "✗ broken", "↷ absent", "  more", "raw"]);
			expect(result.stderr).toEqual([]);
		}),
	);

	it.effect("puts an item's detail lines under it, indented", () =>
		Effect.gen(function* () {
			const result = yield* printed([Report.fail("hook missing", "run savvy commit init", "then retry")]);
			expect(result.stdout).toEqual(["✗ hook missing", "  run savvy commit init", "  then retry"]);
		}),
	);

	describe("summary", () => {
		it.effect("counts each kind, leaving zeros out, with a singular warning", () =>
			Effect.gen(function* () {
				const result = yield* printed([Report.summary({ ok: 3, warn: 1, fail: 2 })]);
				expect(result.stdout).toEqual(["3 ok, 1 warning, 2 failed"]);
				const plural = yield* printed([Report.summary({ ok: 2, warn: 2 })]);
				expect(plural.stdout).toEqual(["2 ok, 2 warnings"]);
			}),
		);

		it.effect("reads nothing to do when every count is zero or absent", () =>
			Effect.gen(function* () {
				expect((yield* printed([Report.summary({})])).stdout).toEqual(["nothing to do"]);
				expect((yield* printed([Report.summary({ ok: 0, warn: 0, fail: 0 })])).stdout).toEqual(["nothing to do"]);
			}),
		);
	});

	describe("follows the audience", () => {
		it.effect("paints the glyph, not the text, for a person at a colour terminal", () =>
			Effect.gen(function* () {
				const result = yield* printed([Report.fail("c")], env({ tty: true, audience: "human", color: "basic" }));
				expect(result.stdout[0]).toContain(ESC);
				expect(unpaint(result.stdout[0] ?? "")).toBe("✗ c");
			}),
		);

		it.effect("writes no escapes on a pipe", () =>
			Effect.gen(function* () {
				const result = yield* printed([Report.fail("c")], env({ tty: false, audience: "human", color: "none" }));
				expect(result.stdout).toEqual(["✗ c"]);
			}),
		);

		it.effect("never writes an escape for an agent, even on a colour terminal", () =>
			Effect.gen(function* () {
				const result = yield* printed(
					[Report.heading("Section"), Report.fail("c")],
					env({ tty: true, audience: "agent", color: "truecolor" }),
				);
				expect(result.stdout.join("\n")).not.toContain(ESC);
				expect(result.stdout).toContain("✗ c");
			}),
		);
	});

	describe("wrapping", () => {
		const long = `/${"segment/".repeat(15)}package.json has a finding`;

		it.effect("never wraps on a pipe, so a long path stays on one line", () =>
			Effect.gen(function* () {
				const result = yield* printed([Report.fail(long, `detail ${long}`)]);
				expect(result.stdout).toEqual([`✗ ${long}`, `  detail ${long}`]);
			}),
		);

		it.effect("wraps to the terminal's width on a terminal", () =>
			Effect.gen(function* () {
				const result = yield* printed(
					[Report.fail(long)],
					env({ tty: true, audience: "human", color: "none", columns: 40 }),
				);
				expect(result.stdout.length).toBeGreaterThan(1);
			}),
		);
	});
});
