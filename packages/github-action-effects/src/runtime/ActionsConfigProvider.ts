import { ConfigProvider, Effect } from "effect";

/**
 * A `ConfigProvider` that reads GitHub Actions inputs from the process environment.
 *
 * GitHub Actions populates action inputs as environment variables with the prefix
 * `INPUT_`, with spaces replaced by underscores and the name uppercased. Hyphens
 * are preserved (not converted to underscores), matching GitHub Actions behavior.
 *
 * For example:
 * - `Config.string("name")` reads `INPUT_NAME`
 * - `Config.string("retry-count")` reads `INPUT_RETRY-COUNT`
 * - `Config.string("my input")` reads `INPUT_MY_INPUT`
 *
 * Empty string values are treated as missing and produce a missing-data
 * `Config.ConfigError`.
 *
 * @example
 * ```ts
 * const program = Effect.provide(
 *   Config.string("my-input"),
 *   ConfigProvider.layer(ActionsConfigProvider)
 * )
 * ```
 * @public
 */
export const ActionsConfigProvider: ConfigProvider.ConfigProvider = ConfigProvider.make((path) => {
	const key = `INPUT_${path.join("_").replaceAll(" ", "_").toUpperCase()}`;
	const value = process.env[key];

	if (value === undefined || value === "") {
		// "Not found" is modeled as `undefined`; the Config layer raises the
		// missing-data error. `SourceError` is reserved for I/O failures.
		return Effect.succeed(undefined);
	}

	return Effect.succeed(ConfigProvider.makeValue(value));
});
