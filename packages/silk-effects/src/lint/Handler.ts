/**
 * Abstract base class for all lint-staged handlers.
 *
 * Provides the static class pattern for TSDoc-friendly documentation.
 *
 * @example
 * ```typescript
 * import { Biome } from '@savvy-web/silk/lint';
 *
 * // Use default handler
 * export default {
 *   [Biome.glob]: Biome.handler,
 * };
 *
 * // Use customized handler
 * export default {
 *   [Biome.glob]: Biome.create({ exclude: ['vendor/'] }),
 * };
 * ```
 */

import type { BaseHandlerOptions, LintStagedHandler } from "./types.js"; // types.ts lives alongside Handler.ts in src/lint/

/**
 * Abstract base class for lint-staged handlers.
 *
 * All handler classes follow this pattern and implement:
 * - `glob` - The recommended glob pattern for matching files
 * - `defaultExcludes` - Default patterns to exclude
 * - `handler` - Pre-configured handler with defaults
 * - `create()` - Factory method for custom configuration
 */
export abstract class Handler {
	/**
	 * Default glob pattern for this handler.
	 * Use as the key in lint-staged config.
	 */
	static readonly glob: string;

	/**
	 * Default exclude patterns applied when no options provided.
	 */
	static readonly defaultExcludes: readonly string[];

	/**
	 * Pre-configured handler with default options.
	 * Ready to use directly in lint-staged config.
	 */
	static readonly handler: LintStagedHandler;

	/**
	 * Factory method to create a handler with custom options.
	 *
	 * @param _options - Configuration options for this handler
	 * @returns A lint-staged compatible handler function
	 */
	static create(_options?: BaseHandlerOptions): LintStagedHandler {
		/* v8 ignore next -- abstract factory; always overridden by concrete subclasses */
		throw new Error("Handler.create() must be implemented by subclass");
	}
}
