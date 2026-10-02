import { describe, expect, it } from "@effect/vitest";
import { Data, Effect } from "effect";

import { CommandError } from "../src/internal/command-error.js";
import { Capture } from "./utils/capture.js";

class ConfigReadError extends Data.TaggedError("ConfigReadError")<{ readonly path: string }> {}

const full = new CommandError({
	message: "could not read the changeset config",
	detail: [".changeset/config.json: unexpected token"],
	hint: "run savvy init to write a fresh one",
});

describe("CommandError", () => {
	describe("through main's failure report", () => {
		it.effect("draws its document for a person: status line, indented detail, tip callout; exit 1", () =>
			Effect.gen(function* () {
				const result = yield* Capture.main(Effect.fail(full));
				expect(result.exitCode).toBe(1);
				expect(result.stdout).toEqual([]);
				const report = result.stderr.join("\n");
				expect(report).toContain("✗ could not read the changeset config");
				expect(report).toContain("  .changeset/config.json: unexpected token");
				expect(report).toContain("TIP: run savvy init to write a fresh one");
				expect(report).not.toContain("CommandError");
				expect(report).not.toContain("\u001b[");
			}),
		);

		it.effect("draws plain, escape-free text for an agent; exit 1", () =>
			Effect.gen(function* () {
				const result = yield* Capture.main(Effect.fail(full), { audience: "agent" });
				expect(result.exitCode).toBe(1);
				const report = result.stderr.join("\n");
				expect(report).toContain("could not read the changeset config");
				expect(report).toContain(".changeset/config.json: unexpected token");
				expect(report).toContain("run savvy init to write a fresh one");
				expect(report).not.toContain("\u001b[");
			}),
		);

		it.effect("leaves out the detail and the callout when there are none", () =>
			Effect.gen(function* () {
				const result = yield* Capture.main(Effect.fail(new CommandError({ message: "nothing to clean" })));
				expect(result.exitCode).toBe(1);
				expect(result.stderr.join("\n").trim()).toBe("✗ nothing to clean");
			}),
		);
	});

	describe("from", () => {
		it("keeps the foreign error as cause and its description as the last detail line", () => {
			const foreign = new ConfigReadError({ path: "/repo/.changeset/config.json" });
			const error = CommandError.from(foreign, { message: "could not read the config", hint: "check the path" });
			expect(error.message).toBe("could not read the config");
			expect(error.detail).toEqual(["ConfigReadError: path: /repo/.changeset/config.json"]);
			expect(error.hint).toBe("check the path");
			expect(error.cause).toBe(foreign);
		});

		it("puts the caller's detail first and drops a description that repeats the message", () => {
			const error = CommandError.from(new Error("boom"), { message: "boom", detail: ["while cleaning dist"] });
			expect(error.detail).toEqual(["while cleaning dist"]);
			expect("hint" in error).toBe(false);
		});
	});
});
