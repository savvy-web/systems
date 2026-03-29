import { Schema } from "effect";

/**
 * The discovery strategy used to locate a config file.
 *
 * @remarks
 * - `"lib"` — found under `lib/configs/{name}` relative to the workspace root.
 * - `"root"` — found directly in the workspace root as `{name}`.
 * - `"cosmiconfig"` — reserved for future cosmiconfig-based discovery.
 *
 * @since 0.1.0
 */
export const ConfigSource = Schema.Literal("lib", "root", "cosmiconfig");
/** @since 0.1.0 */
export type ConfigSource = typeof ConfigSource.Type;

/**
 * The resolved location of a discovered config file.
 *
 * @remarks
 * Produced by {@link ConfigDiscovery.find} and {@link ConfigDiscovery.findAll}.
 * `path` is the absolute file path; `source` indicates how it was discovered.
 *
 * @since 0.1.0
 */
export const ConfigLocation = Schema.Struct({
	path: Schema.String,
	source: ConfigSource,
});
/** @since 0.1.0 */
export type ConfigLocation = typeof ConfigLocation.Type;

/**
 * Options passed to config discovery methods.
 *
 * @remarks
 * `cwd` overrides the working directory for path resolution (defaults to `process.cwd()`).
 * `tool` is reserved for future use as a tool-specific discovery hint.
 *
 * @since 0.1.0
 */
export const ConfigDiscoveryOptions = Schema.Struct({
	cwd: Schema.optional(Schema.String),
	tool: Schema.optional(Schema.String),
});
/** @since 0.1.0 */
export type ConfigDiscoveryOptions = typeof ConfigDiscoveryOptions.Type;
