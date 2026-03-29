import { Effect, Exit } from "effect";
import { describe, expect, it } from "vitest";
import { TagFormatError } from "../errors/TagFormatError.js";
import type { VersioningStrategyResult } from "../schemas/VersioningSchemas.js";
import { TagStrategy, TagStrategyLive } from "./TagStrategy.js";

const run = <A, E>(effect: Effect.Effect<A, E, TagStrategy>) =>
	Effect.runPromise(effect.pipe(Effect.provide(TagStrategyLive)));

const runExit = <A, E>(effect: Effect.Effect<A, E, TagStrategy>) =>
	Effect.runPromiseExit(effect.pipe(Effect.provide(TagStrategyLive)));

function makeVersioningResult(type: VersioningStrategyResult["type"]): VersioningStrategyResult {
	return { type, fixedGroups: [], publishablePackages: [] };
}

describe("TagStrategy", () => {
	describe("determine", () => {
		it("returns 'single' for single strategy type", async () => {
			const result = await run(
				Effect.gen(function* () {
					const strategy = yield* TagStrategy;
					return yield* strategy.determine(makeVersioningResult("single"));
				}),
			);
			expect(result).toBe("single");
		});

		it("returns 'single' for fixed-group strategy type", async () => {
			const result = await run(
				Effect.gen(function* () {
					const strategy = yield* TagStrategy;
					return yield* strategy.determine(makeVersioningResult("fixed-group"));
				}),
			);
			expect(result).toBe("single");
		});

		it("returns 'scoped' for independent strategy type", async () => {
			const result = await run(
				Effect.gen(function* () {
					const strategy = yield* TagStrategy;
					return yield* strategy.determine(makeVersioningResult("independent"));
				}),
			);
			expect(result).toBe("scoped");
		});
	});

	describe("formatTag", () => {
		it("formats single tag as bare version (strict SemVer 2.0.0, no v prefix)", async () => {
			const result = await run(
				Effect.gen(function* () {
					const strategy = yield* TagStrategy;
					return yield* strategy.formatTag("my-pkg", "1.2.3", "single");
				}),
			);
			expect(result).toBe("1.2.3");
		});

		it("formats scoped tag for scoped package as @scope/pkg@1.2.3", async () => {
			const result = await run(
				Effect.gen(function* () {
					const strategy = yield* TagStrategy;
					return yield* strategy.formatTag("@scope/pkg", "1.2.3", "scoped");
				}),
			);
			expect(result).toBe("@scope/pkg@1.2.3");
		});

		it("formats scoped tag for unscoped package as pkg@1.2.3", async () => {
			const result = await run(
				Effect.gen(function* () {
					const strategy = yield* TagStrategy;
					return yield* strategy.formatTag("my-pkg", "1.2.3", "scoped");
				}),
			);
			expect(result).toBe("my-pkg@1.2.3");
		});

		it("fails with TagFormatError for empty version", async () => {
			const exit = await runExit(
				Effect.gen(function* () {
					const strategy = yield* TagStrategy;
					return yield* strategy.formatTag("my-pkg", "", "single");
				}),
			);
			expect(exit._tag).toBe("Failure");
			if (Exit.isFailure(exit)) {
				const cause = exit.cause;
				expect(cause._tag).toBe("Fail");
				if (cause._tag === "Fail") {
					expect(cause.error).toBeInstanceOf(TagFormatError);
					expect((cause.error as TagFormatError)._tag).toBe("TagFormatError");
				}
			}
		});
	});
});
