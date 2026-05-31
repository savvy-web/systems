import { Effect, Exit } from "effect";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { runInit } from "../src/commands/init.js";

beforeEach(() => {
	vi.spyOn(console, "log").mockImplementation(() => {});
	vi.spyOn(console, "info").mockImplementation(() => {});
	vi.spyOn(console, "warn").mockImplementation(() => {});
	vi.spyOn(console, "error").mockImplementation(() => {});
	vi.spyOn(console, "debug").mockImplementation(() => {});
});

describe("savvy init orchestrator", () => {
	it("runs changeset, commit, and lint init in order and succeeds", async () => {
		const calls: string[] = [];
		const exit = await Effect.runPromiseExit(
			runInit({
				changeset: Effect.sync(() => calls.push("changeset")),
				commit: Effect.sync(() => calls.push("commit")),
				lint: Effect.sync(() => calls.push("lint")),
			}),
		);
		expect(Exit.isSuccess(exit)).toBe(true);
		expect(calls).toEqual(["changeset", "commit", "lint"]);
	});

	it("short-circuits: stops at the first failing step", async () => {
		const calls: string[] = [];
		const exit = await Effect.runPromiseExit(
			runInit({
				changeset: Effect.sync(() => calls.push("changeset")),
				commit: Effect.fail(new Error("commit failed")),
				lint: Effect.sync(() => calls.push("lint")),
			}),
		);
		expect(Exit.isFailure(exit)).toBe(true);
		expect(calls).toEqual(["changeset"]); // lint never runs
	});
});
