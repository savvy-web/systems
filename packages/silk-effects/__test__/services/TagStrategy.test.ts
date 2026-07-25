import { describe, expect, layer } from "@effect/vitest";
import { Effect } from "effect";
import { TagFormatError } from "../../src/errors/TagFormatError.js";
import type { VersioningStrategyResult } from "../../src/schemas/VersioningSchemas.js";
import { TagStrategy, TagStrategyLive } from "../../src/services/TagStrategy.js";

function makeVersioningResult(type: VersioningStrategyResult["type"]): VersioningStrategyResult {
	return { type, fixedGroups: [], publishablePackages: [] };
}

layer(TagStrategyLive)("TagStrategy", (it) => {
	describe("determine", () => {
		it.effect("returns 'single' for single strategy type", () =>
			Effect.gen(function* () {
				const strategy = yield* TagStrategy;
				const result = yield* strategy.determine(makeVersioningResult("single"));
				expect(result).toBe("single");
			}),
		);

		it.effect("returns 'single' for fixed-group strategy type", () =>
			Effect.gen(function* () {
				const strategy = yield* TagStrategy;
				const result = yield* strategy.determine(makeVersioningResult("fixed-group"));
				expect(result).toBe("single");
			}),
		);

		it.effect("returns 'scoped' for independent strategy type", () =>
			Effect.gen(function* () {
				const strategy = yield* TagStrategy;
				const result = yield* strategy.determine(makeVersioningResult("independent"));
				expect(result).toBe("scoped");
			}),
		);
	});

	describe("formatTag", () => {
		it.effect("formats single tag as bare version (strict SemVer 2.0.0, no v prefix)", () =>
			Effect.gen(function* () {
				const strategy = yield* TagStrategy;
				const result = yield* strategy.formatTag("my-pkg", "1.2.3", "single");
				expect(result).toBe("1.2.3");
			}),
		);

		it.effect("formats scoped tag for scoped package as @scope/pkg@1.2.3", () =>
			Effect.gen(function* () {
				const strategy = yield* TagStrategy;
				const result = yield* strategy.formatTag("@scope/pkg", "1.2.3", "scoped");
				expect(result).toBe("@scope/pkg@1.2.3");
			}),
		);

		it.effect("formats scoped tag for unscoped package as pkg@1.2.3", () =>
			Effect.gen(function* () {
				const strategy = yield* TagStrategy;
				const result = yield* strategy.formatTag("my-pkg", "1.2.3", "scoped");
				expect(result).toBe("my-pkg@1.2.3");
			}),
		);

		// `Effect.flip` replaces the previous runExit + Exit.isFailure guard. The
		// dropped is-a-Failure assertion is subsumed structurally: flip FAILS the
		// test if the effect succeeds. The two remaining assertions now run
		// unconditionally instead of inside a guard that silently skipped them on
		// a success — strictly stronger.
		it.effect("fails with TagFormatError for empty version", () =>
			Effect.gen(function* () {
				const strategy = yield* TagStrategy;
				const error = yield* Effect.flip(strategy.formatTag("my-pkg", "", "single"));
				expect(error).toBeInstanceOf(TagFormatError);
				expect(error._tag).toBe("TagFormatError");
			}),
		);
	});
});
