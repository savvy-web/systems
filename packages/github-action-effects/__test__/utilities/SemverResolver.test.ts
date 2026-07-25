import { describe, expect, it } from "@effect/vitest";
import { Effect, Exit } from "effect";
import { SemverResolver } from "../../src/utils/SemverResolver.js";

describe("SemverResolver", () => {
	it.effect("compares versions", () =>
		Effect.gen(function* () {
			expect(yield* SemverResolver.compare("1.0.0", "2.0.0")).toBe(-1);
			expect(yield* SemverResolver.compare("2.0.0", "1.0.0")).toBe(1);
			expect(yield* SemverResolver.compare("1.0.0", "1.0.0")).toBe(0);
		}),
	);

	it.effect("checks satisfies", () =>
		Effect.gen(function* () {
			expect(yield* SemverResolver.satisfies("1.2.3", "^1.0.0")).toBe(true);
			expect(yield* SemverResolver.satisfies("2.0.0", "^1.0.0")).toBe(false);
		}),
	);

	it.effect("finds latest in range", () =>
		Effect.gen(function* () {
			const result = yield* SemverResolver.latestInRange(["1.0.0", "1.2.0", "1.5.0", "2.0.0"], "^1.0.0");
			expect(result).toBe("1.5.0");
		}),
	);

	it.effect("fails when no version satisfies range", () =>
		Effect.gen(function* () {
			const exit = yield* Effect.exit(SemverResolver.latestInRange(["3.0.0"], "^1.0.0"));
			expect(Exit.isFailure(exit)).toBe(true);
		}),
	);

	it.effect("increments versions", () =>
		Effect.gen(function* () {
			expect(yield* SemverResolver.increment("1.2.3", "patch")).toBe("1.2.4");
			expect(yield* SemverResolver.increment("1.2.3", "minor")).toBe("1.3.0");
			expect(yield* SemverResolver.increment("1.2.3", "major")).toBe("2.0.0");
		}),
	);

	it.effect("parses versions", () =>
		Effect.gen(function* () {
			const result = yield* SemverResolver.parse("1.2.3-beta.1");
			expect(result).toEqual({
				major: 1,
				minor: 2,
				patch: 3,
				prerelease: "beta.1",
			});
		}),
	);

	it.effect("fails on invalid version", () =>
		Effect.gen(function* () {
			const exit = yield* Effect.exit(SemverResolver.parse("not-a-version"));
			expect(Exit.isFailure(exit)).toBe(true);
		}),
	);

	it.effect("fails compare with invalid semver", () =>
		Effect.gen(function* () {
			const exit = yield* Effect.exit(SemverResolver.compare("invalid", "1.0.0"));
			expect(Exit.isFailure(exit)).toBe(true);
		}),
	);

	it.effect("fails increment with invalid version", () =>
		Effect.gen(function* () {
			const exit = yield* Effect.exit(SemverResolver.increment("not-valid", "patch"));
			expect(Exit.isFailure(exit)).toBe(true);
		}),
	);

	it.effect("parses version without prerelease or build", () =>
		Effect.gen(function* () {
			const result = yield* SemverResolver.parse("2.0.0");
			expect(result).toEqual({ major: 2, minor: 0, patch: 0 });
			expect(result).not.toHaveProperty("prerelease");
			expect(result).not.toHaveProperty("build");
		}),
	);

	it.effect("parses version with build metadata", () =>
		Effect.gen(function* () {
			const result = yield* SemverResolver.parse("1.0.0+build.123");
			expect(result).toEqual({ major: 1, minor: 0, patch: 0, build: "build.123" });
		}),
	);

	it.effect("increments prerelease", () =>
		Effect.gen(function* () {
			const result = yield* SemverResolver.increment("1.0.0", "prerelease");
			expect(result).toBe("1.0.1-0");
		}),
	);

	it.effect("satisfies returns false for non-matching range", () =>
		Effect.gen(function* () {
			const result = yield* SemverResolver.satisfies("3.0.0", "~1.2.0");
			expect(result).toBe(false);
		}),
	);

	it.effect("latestInRange fails with descriptive error", () =>
		Effect.gen(function* () {
			const exit = yield* Effect.exit(SemverResolver.latestInRange(["1.0.0", "2.0.0"], ">=5.0.0"));
			expect(Exit.isFailure(exit)).toBe(true);
		}),
	);
});
