/**
 * Handler for shell script files.
 *
 * Manages executable permissions on shell scripts.
 */

import type { LintStagedHandler, ShellScriptsOptions } from "../types.js";
import { Filter } from "../utils/Filter.js";

/**
 * Handler for shell script files.
 *
 * Removes executable bit by default (security best practice).
 *
 * @remarks
 * By default, excludes `.claude/scripts/` which need to remain executable
 * for lint-staged hooks to work.
 *
 * @example
 * ```typescript
 * import { ShellScripts } from '@savvy-web/lint-staged';
 *
 * export default {
 *   [ShellScripts.glob]: ShellScripts.create({
 *     exclude: ['.claude/scripts/', 'bin/'],
 *   }),
 * };
 * ```
 */
// biome-ignore lint/complexity/noStaticOnlyClass: Intentional pattern for TSDoc discoverability
export class ShellScripts {
	/**
	 * Glob pattern for matching shell script files.
	 * @defaultValue `'**\/*.sh'`
	 */
	static readonly glob = "**/*.sh";

	/**
	 * Default patterns to exclude from processing.
	 * @defaultValue `['.claude/scripts/']`
	 */
	static readonly defaultExcludes = [".claude/scripts/"] as const;

	/**
	 * Pre-configured handler with default options.
	 */
	static readonly handler: LintStagedHandler = ShellScripts.create();

	/**
	 * Create a handler with custom options.
	 *
	 * @param options - Configuration options
	 * @returns A lint-staged compatible handler function
	 */
	static create(options: ShellScriptsOptions = {}): LintStagedHandler {
		const excludes = options.exclude ?? [...ShellScripts.defaultExcludes];
		const makeExecutable = options.makeExecutable ?? false;

		return (filenames: readonly string[]): string | string[] => {
			const filtered = Filter.exclude(filenames, excludes);

			if (filtered.length === 0) {
				return [];
			}

			const chmodFlag = makeExecutable ? "+x" : "-x";

			// Return one command per file
			return filtered.map((file) => `chmod ${chmodFlag} ${file}`);
		};
	}
}
