import { Context, Effect, Layer } from "effect";
import { ChangesetConfigReader } from "./ChangesetConfigReader.js";
import type { VersioningDetectionError } from "./errors.js";
import type { VersioningStrategyResult } from "./schemas.js";

/**
 * Service that classifies the versioning strategy used by a workspace.
 *
 * @remarks
 * Reads the changesets config to inspect `fixed` groups, then determines whether
 * the workspace uses a single-package, fixed-group, or independent versioning strategy.
 * Falls back to safe defaults when the changeset config is unavailable.
 *
 * @example
 * ```typescript
 * const result = await Effect.runPromise(
 *   Effect.gen(function* () {
 *     const strategy = yield* VersioningStrategy;
 *     return yield* strategy.detect(["@my-org/pkg-a", "@my-org/pkg-b"]);
 *   }).pipe(
 *     Effect.provide(VersioningStrategyLive),
 *     Effect.provide(ChangesetConfigReaderLive),
 *     Effect.provide(NodeContext.layer),
 *   )
 * );
 * ```
 *
 * @since 0.1.0
 */
export class VersioningStrategy extends Context.Tag("@savvy-web/silk-effects/VersioningStrategy")<
	VersioningStrategy,
	{
		/**
		 * Classify the versioning strategy for a list of publishable package names.
		 *
		 * @param publishablePackages - Package names (e.g. `"@my-org/pkg"`) that will be published.
		 * @param root - Workspace root directory to read changeset config from.
		 * @returns An `Effect` resolving to a {@link VersioningStrategyResult}, or failing with
		 *   {@link VersioningDetectionError} on unexpected errors.
		 *
		 * @since 0.1.0
		 */
		readonly detect: (
			publishablePackages: ReadonlyArray<string>,
			root: string,
		) => Effect.Effect<VersioningStrategyResult, VersioningDetectionError>;
	}
>() {}

/**
 * Live implementation of {@link VersioningStrategy}.
 *
 * @remarks
 * Requires {@link ChangesetConfigReader} to read the workspace changeset configuration.
 * If the config file is absent, an empty `fixed` groups array is assumed.
 *
 * @since 0.1.0
 */
export const VersioningStrategyLive: Layer.Layer<VersioningStrategy, never, ChangesetConfigReader> = Layer.effect(
	VersioningStrategy,
	Effect.gen(function* () {
		const configReader = yield* ChangesetConfigReader;

		const detect = (
			publishablePackages: ReadonlyArray<string>,
			root: string,
		): Effect.Effect<VersioningStrategyResult, VersioningDetectionError> =>
			Effect.gen(function* () {
				// Read config, falling back to defaults on error
				const config = yield* configReader
					.read(root)
					.pipe(Effect.orElseSucceed(() => ({ fixed: [] as string[][], linked: [] as string[][] })));

				const fixed = config.fixed ?? [];
				const packages = [...publishablePackages];

				// Single package (or no publishable packages)
				if (packages.length <= 1) {
					return {
						type: "single" as const,
						fixedGroups: fixed,
						publishablePackages: packages,
					};
				}

				// Check if all publishable packages are in a single fixed group
				const containingGroup = fixed.find((group) => packages.every((pkg) => group.includes(pkg)));

				if (containingGroup !== undefined) {
					return {
						type: "fixed-group" as const,
						fixedGroups: fixed,
						publishablePackages: packages,
					};
				}

				// Multiple publishable packages not all in same fixed group
				return {
					type: "independent" as const,
					fixedGroups: fixed,
					publishablePackages: packages,
				};
			});

		return { detect };
	}),
);
