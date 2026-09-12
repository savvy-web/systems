import { describe, expect, it } from "@effect/vitest";
import { Effect, Layer } from "effect";
import { afterEach, vi } from "vitest";

import { ChangesetLogMode, logWarning } from "../../src/changesets/utils/logger.js";

const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

afterEach(() => {
	warn.mockClear();
});

describe("ChangesetLogMode", () => {
	it.effect("defaults to stderr when no front end provides it", () =>
		Effect.gen(function* () {
			expect(yield* ChangesetLogMode).toBe("stderr");
		}),
	);

	it.effect("is overridden by Effect.provideService", () =>
		Effect.gen(function* () {
			expect(yield* ChangesetLogMode).toBe("github");
		}).pipe(Effect.provideService(ChangesetLogMode, "github")),
	);

	it.effect("is overridden by a Layer", () =>
		Effect.gen(function* () {
			expect(yield* ChangesetLogMode).toBe("silent");
		}).pipe(Effect.provide(Layer.succeed(ChangesetLogMode, "silent"))),
	);
});

describe("logWarning", () => {
	it.effect("stderr (default): console.warn with the arguments spread", () =>
		Effect.gen(function* () {
			yield* logWarning("Duplicate dependency entry", "effect@3.19.0");
			expect(warn).toHaveBeenCalledTimes(1);
			expect(warn).toHaveBeenCalledWith("Duplicate dependency entry", "effect@3.19.0");
		}),
	);

	it.effect("github: a single ::warning:: annotation with the arguments joined", () =>
		Effect.gen(function* () {
			yield* logWarning("Duplicate dependency entry", "effect@3.19.0", 42);
			expect(warn).toHaveBeenCalledTimes(1);
			expect(warn).toHaveBeenCalledWith("::warning::Duplicate dependency entry effect@3.19.0 42");
		}).pipe(Effect.provideService(ChangesetLogMode, "github")),
	);

	it.effect("github: no trailing space when there are no extra arguments", () =>
		Effect.gen(function* () {
			yield* logWarning("Plain");
			expect(warn).toHaveBeenCalledWith("::warning::Plain");
		}).pipe(Effect.provideService(ChangesetLogMode, "github")),
	);

	it.effect("silent: nothing is written", () =>
		Effect.gen(function* () {
			yield* logWarning("Duplicate dependency entry", "effect@3.19.0");
			expect(warn).not.toHaveBeenCalled();
		}).pipe(Effect.provideService(ChangesetLogMode, "silent")),
	);
});
