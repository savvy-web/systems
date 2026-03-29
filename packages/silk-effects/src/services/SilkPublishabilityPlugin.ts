import { Context, Effect, Layer } from "effect";
import type { TargetResolutionError } from "../errors/TargetResolutionError.js";
import type { ResolvedTarget } from "../schemas/PublishabilitySchemas.js";
import { TargetResolver } from "./TargetResolver.js";

/**
 * Service that determines whether a package is publishable and resolves its targets.
 *
 * @remarks
 * Inspects the `package.json` object using the Silk publishability rules:
 * - `private: true` with no `publishConfig` → not publishable (empty array).
 * - `publishConfig` without `access` or `targets` → not publishable.
 * - `publishConfig.targets` (array) → resolved via {@link TargetResolver}.
 * - `publishConfig.registry` → resolved as a single registry target.
 * - Default → resolved as `"npm"`.
 *
 * @example
 * ```typescript
 * const result = await Effect.runPromise(
 *   Effect.gen(function* () {
 *     const plugin = yield* SilkPublishabilityPlugin;
 *     return yield* plugin.detect({ publishConfig: { access: "public" } });
 *   }).pipe(
 *     Effect.provide(SilkPublishabilityPluginLive),
 *     Effect.provide(TargetResolverLive),
 *   )
 * );
 * ```
 *
 * @since 0.1.0
 */
export class SilkPublishabilityPlugin extends Context.Tag("@savvy-web/silk-effects/SilkPublishabilityPlugin")<
	SilkPublishabilityPlugin,
	{
		/**
		 * Inspect a parsed `package.json` object and return the resolved publish targets.
		 *
		 * @param pkgJson - The parsed `package.json` contents.
		 * @returns An `Effect` that succeeds with an array of {@link ResolvedTarget} records
		 *   (empty when the package is not publishable), or fails with {@link TargetResolutionError}.
		 *
		 * @since 0.1.0
		 */
		readonly detect: (
			pkgJson: Record<string, unknown>,
		) => Effect.Effect<ReadonlyArray<ResolvedTarget>, TargetResolutionError>;
	}
>() {}

/**
 * Live implementation of {@link SilkPublishabilityPlugin}.
 *
 * @remarks
 * Requires {@link TargetResolver} to resolve target strings and objects.
 *
 * @since 0.1.0
 */
export const SilkPublishabilityPluginLive = Layer.effect(
	SilkPublishabilityPlugin,
	Effect.gen(function* () {
		const resolver = yield* TargetResolver;

		return {
			detect: (pkgJson: Record<string, unknown>) => {
				const isPrivate = pkgJson.private === true;
				const publishConfig = pkgJson.publishConfig as Record<string, unknown> | undefined;

				// Rule 1: private === true AND no publishConfig → NOT publishable
				if (isPrivate && !publishConfig) {
					return Effect.succeed([]);
				}

				// Rule 2: no publishConfig.access AND no publishConfig.targets → NOT publishable
				if (!publishConfig || (!publishConfig.access && !publishConfig.targets)) {
					return Effect.succeed([]);
				}

				// Rule 3: publishConfig.targets is an array → resolve via TargetResolver
				if (Array.isArray(publishConfig.targets)) {
					return resolver.resolve(publishConfig.targets);
				}

				// Rule 4: publishConfig.registry exists → resolve that single registry
				if (publishConfig.registry) {
					return resolver.resolve(publishConfig.registry);
				}

				// Rule 5: Default — resolve "npm" shorthand
				return resolver.resolve("npm");
			},
		};
	}),
);
