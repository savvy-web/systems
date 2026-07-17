import type { Effect, Schema } from "effect";
import { Context } from "effect";
import type { ConfigLoaderError } from "../errors/ConfigLoaderError.js";

/**
 * Service shape for {@link ConfigLoader}.
 *
 * @public
 */
export interface ConfigLoaderShape {
	/** Load and validate a JSON config file. */
	readonly loadJson: <T>(path: string, schema: Schema.Codec<T>) => Effect.Effect<T, ConfigLoaderError>;

	/** Load and validate a JSONC (JSON with Comments) config file. */
	readonly loadJsonc: <T>(path: string, schema: Schema.Codec<T>) => Effect.Effect<T, ConfigLoaderError>;

	/** Load and validate a YAML config file. */
	readonly loadYaml: <T>(path: string, schema: Schema.Codec<T>) => Effect.Effect<T, ConfigLoaderError>;

	/** Check if a config file exists at the given path. */
	readonly exists: (path: string) => Effect.Effect<boolean>;
}

/**
 * Service for loading and validating config files.
 *
 * Supports JSON, JSONC, and YAML formats with Effect Schema validation.
 *
 * @public
 */
export class ConfigLoader extends Context.Service<ConfigLoader, ConfigLoaderShape>()(
	"github-action-effects/ConfigLoader",
) {}
