import { Context, Effect, Layer } from "effect";
import { TagFormatError } from "../errors/TagFormatError.js";
import type { TagStrategyType } from "../schemas/TagStrategySchemas.js";
import type { VersioningStrategyResult } from "../schemas/VersioningSchemas.js";

/**
 * Service that determines and applies the git-tag naming strategy for a release.
 *
 * @remarks
 * Consumes a {@link VersioningStrategyResult} to pick between `"single"` and `"scoped"`
 * tag formats, then formats tag strings accordingly. Independent versioning always
 * produces scoped tags; single and fixed-group versioning produces a single shared tag.
 *
 * @example
 * ```typescript
 * const result = await Effect.runPromise(
 *   Effect.gen(function* () {
 *     const tags = yield* TagStrategy;
 *     const strategyType = yield* tags.determine({ type: "independent", fixedGroups: [], publishablePackages: [] });
 *     return yield* tags.formatTag("@my-org/pkg", "1.2.3", strategyType);
 *   }).pipe(Effect.provide(TagStrategyLive))
 * );
 * // => "@my-org/pkg@1.2.3"
 * ```
 *
 * @since 0.1.0
 */
export class TagStrategy extends Context.Tag("@savvy-web/silk-effects/TagStrategy")<
	TagStrategy,
	{
		/**
		 * Determine the appropriate tag strategy type from a versioning strategy result.
		 *
		 * @param versioningResult - The result of {@link VersioningStrategy.detect}.
		 * @returns An `Effect` that always succeeds with a {@link TagStrategyType}.
		 *
		 * @since 0.1.0
		 */
		readonly determine: (versioningResult: VersioningStrategyResult) => Effect.Effect<TagStrategyType>;

		/**
		 * Format a git tag string for a given package name, version, and strategy.
		 *
		 * @param name - The package name (e.g. `"@my-org/pkg"` or `"my-pkg"`).
		 * @param version - The semver version string (e.g. `"1.2.3"`). Must not be empty.
		 * @param strategy - The {@link TagStrategyType} to apply.
		 * @returns An `Effect` that resolves to the formatted tag string, or fails with
		 *   {@link TagFormatError} when `version` is empty.
		 *
		 * @since 0.1.0
		 */
		readonly formatTag: (
			name: string,
			version: string,
			strategy: TagStrategyType,
		) => Effect.Effect<string, TagFormatError>;
	}
>() {}

/**
 * Live implementation of {@link TagStrategy} with no external dependencies.
 *
 * @remarks
 * All logic is pure: strategy determination and tag formatting involve no I/O.
 *
 * @since 0.1.0
 */
export const TagStrategyLive: Layer.Layer<TagStrategy> = Layer.succeed(
	TagStrategy,
	TagStrategy.of({
		determine: (versioningResult) => {
			if (versioningResult.type === "independent") {
				return Effect.succeed("scoped" as const);
			}
			return Effect.succeed("single" as const);
		},

		formatTag: (name, version, strategy) => {
			if (version === "") {
				return Effect.fail(
					new TagFormatError({
						name,
						version,
						reason: "version cannot be empty",
					}),
				);
			}

			if (strategy === "single") {
				return Effect.succeed(version);
			}

			// scoped strategy
			if (name.startsWith("@")) {
				return Effect.succeed(`${name}@${version}`);
			}

			return Effect.succeed(`${name}@${version}`);
		},
	}),
);
