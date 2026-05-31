/**
 * Utilities for filtering staged file lists.
 *
 * @example
 * ```typescript
 * import { Filter } from '@savvy-web/lint-staged';
 *
 * const handler = (filenames: readonly string[]) => {
 *   const filtered = Filter.exclude(filenames, ['dist/', '__fixtures__']);
 *   return filtered.length > 0 ? `biome check ${Filter.shellEscape(filtered)}` : [];
 * };
 * ```
 */

/**
 * Static utility class for filtering file lists.
 */
// biome-ignore lint/complexity/noStaticOnlyClass: Intentional pattern for TSDoc discoverability
export class Filter {
	/**
	 * Exclude files matching any of the given patterns.
	 *
	 * @param filenames - Array of file paths
	 * @param patterns - Patterns to exclude (uses `string.includes()`)
	 * @returns Filtered array of file paths
	 *
	 * @example
	 * ```typescript
	 * const files = ['src/index.ts', 'dist/index.js', '__fixtures__/test.ts'];
	 * const filtered = Filter.exclude(files, ['dist/', '__fixtures__']);
	 * // Result: ['src/index.ts']
	 * ```
	 */
	static exclude(filenames: readonly string[], patterns: readonly string[]): string[] {
		if (patterns.length === 0) {
			return [...filenames];
		}
		return filenames.filter((file) => !patterns.some((pattern) => file.includes(pattern)));
	}

	/**
	 * Include only files matching any of the given patterns.
	 *
	 * @param filenames - Array of file paths
	 * @param patterns - Patterns to include (uses `string.includes()`)
	 * @returns Filtered array of file paths
	 *
	 * @example
	 * ```typescript
	 * const files = ['src/index.ts', 'lib/utils.ts', 'test/foo.test.ts'];
	 * const filtered = Filter.include(files, ['src/', 'lib/']);
	 * // Result: ['src/index.ts', 'lib/utils.ts']
	 * ```
	 */
	static include(filenames: readonly string[], patterns: readonly string[]): string[] {
		if (patterns.length === 0) {
			return [];
		}
		return filenames.filter((file) => patterns.some((pattern) => file.includes(pattern)));
	}

	/**
	 * Combine exclude and include filters.
	 *
	 * @param filenames - Array of file paths
	 * @param options - Filter options
	 * @returns Filtered array of file paths
	 *
	 * @example
	 * ```typescript
	 * const files = ['src/index.ts', 'src/index.test.ts', 'dist/index.js'];
	 * const filtered = Filter.apply(files, {
	 *   include: ['src/'],
	 *   exclude: ['.test.'],
	 * });
	 * // Result: ['src/index.ts']
	 * ```
	 */
	static apply(
		filenames: readonly string[],
		options: {
			include?: readonly string[];
			exclude?: readonly string[];
		},
	): string[] {
		let result: string[] = [...filenames];

		if (options.include && options.include.length > 0) {
			result = Filter.include(result, options.include);
		}

		if (options.exclude && options.exclude.length > 0) {
			result = Filter.exclude(result, options.exclude);
		}

		return result;
	}

	/**
	 * Escape file paths for safe shell command construction.
	 *
	 * Wraps each path in single quotes and escapes any embedded single quotes.
	 * This prevents issues with paths containing spaces or special characters.
	 *
	 * @param filenames - Array of file paths
	 * @returns Space-separated string of shell-escaped paths
	 *
	 * @example
	 * ```typescript
	 * const files = ['/path/to/file.ts', '/path/with spaces/file.ts'];
	 * const escaped = Filter.shellEscape(files);
	 * // Result: "'/path/to/file.ts' '/path/with spaces/file.ts'"
	 * ```
	 */
	static shellEscape(filenames: readonly string[]): string {
		return filenames.map((f) => `'${f.replace(/'/g, "'\\''")}'`).join(" ");
	}
}
