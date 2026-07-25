import { beforeEach, describe, expect, it, vi } from "@effect/vitest";
import { Effect } from "effect";

import { runInit } from "../src/commands/init.js";

beforeEach(() => {
	vi.spyOn(console, "log").mockImplementation(() => {});
	vi.spyOn(console, "info").mockImplementation(() => {});
	vi.spyOn(console, "warn").mockImplementation(() => {});
	vi.spyOn(console, "error").mockImplementation(() => {});
	vi.spyOn(console, "debug").mockImplementation(() => {});
});

describe("savvy init orchestrator", () => {
	it.effect("runs changeset, commit, and lint init in order and succeeds", () =>
		Effect.gen(function* () {
			const calls: string[] = [];
			yield* runInit({
				changeset: Effect.sync(() => calls.push("changeset")),
				commit: Effect.sync(() => calls.push("commit")),
				lint: Effect.sync(() => calls.push("lint")),
			});
			expect(calls).toEqual(["changeset", "commit", "lint"]);
		}),
	);

	it.effect("short-circuits: stops at the first failing step", () =>
		Effect.gen(function* () {
			const calls: string[] = [];
			// `Effect.flip` proves the step's error reaches the TYPED channel.
			const error = yield* Effect.flip(
				runInit({
					changeset: Effect.sync(() => calls.push("changeset")),
					commit: Effect.fail(new Error("commit failed")),
					lint: Effect.sync(() => calls.push("lint")),
				}),
			);
			expect(error).toBeInstanceOf(Error);
			expect(error.message).toBe("commit failed");
			expect(calls).toEqual(["changeset"]); // lint never runs
		}),
	);
});
