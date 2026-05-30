/**
 * Application Layer composition.
 *
 * @remarks
 * Composes all service layers into a single application layer for use
 * with Effect programs. These layers provide the runtime implementations
 * of the service interfaces.
 */
import { Layer } from "effect";

import { BuildServiceLive } from "../services/build-live.js";
import { ConfigServiceLive } from "../services/config-live.js";
import { PersistLocalServiceLive } from "../services/persist-local-live.js";
import { ValidationServiceLive } from "../services/validation-live.js";

/**
 * Layer providing ConfigService (no dependencies).
 *
 * @remarks
 * Use this layer when you only need configuration management.
 *
 * @public
 */
export const ConfigLayer = ConfigServiceLive;

/**
 * Layer providing ValidationService (depends on ConfigService).
 *
 * @remarks
 * Includes ConfigService automatically.
 *
 * @public
 */
export const ValidationLayer = ValidationServiceLive.pipe(Layer.provide(ConfigServiceLive));

/**
 * Layer providing BuildService (depends on ConfigService).
 *
 * @remarks
 * Includes ConfigService automatically.
 *
 * @public
 */
export const BuildLayer = BuildServiceLive.pipe(Layer.provide(ConfigServiceLive));

/**
 * Layer providing PersistLocalService (no dependencies).
 *
 * @remarks
 * Use this layer when you only need persist-local functionality.
 *
 * @public
 */
export const PersistLocalLayer = PersistLocalServiceLive;

/**
 * Combined layer providing all services.
 *
 * @remarks
 * This layer composes ConfigService, ValidationService, BuildService,
 * and PersistLocalService.
 * Use this when you need access to all services in your Effect program.
 *
 * @example Using AppLayer with Effect
 * ```typescript
 * import { Effect } from "effect";
 * import { AppLayer, BuildService, ConfigService } from "@savvy-web/github-action-builder";
 *
 * const program = Effect.gen(function* () {
 *   const configService = yield* ConfigService;
 *   const buildService = yield* BuildService;
 *
 *   const { config } = yield* configService.load();
 *   const result = yield* buildService.build(config);
 *
 *   return result;
 * });
 *
 * Effect.runPromise(program.pipe(Effect.provide(AppLayer)));
 * ```
 *
 * @public
 */
export const AppLayer = Layer.mergeAll(ConfigServiceLive, ValidationLayer, BuildLayer, PersistLocalLayer);
