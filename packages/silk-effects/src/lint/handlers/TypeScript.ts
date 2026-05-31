/**
 * Handler for TypeScript files.
 *
 * Runs type checking with tsgo or tsc.
 */

import type { LintStagedHandler, TypeScriptOptions } from "../types.js";
import type { ToolSearchResult } from "../utils/Command.js";
import { Command } from "../utils/Command.js";
import { Filter } from "../utils/Filter.js";

/**
 * TypeScript compiler to use.
 */
export type TypeScriptCompiler = "tsgo" | "tsc";

/**
 * Handler for TypeScript files.
 *
 * Runs type checking with tsgo or tsc.
 *
 * @remarks
 * Type checking runs on all staged TypeScript files using the configured
 * compiler (tsgo or tsc). The compiler is auto-detected at runtime using
 * `Command.findTool()`, which correctly handles pnpm catalogs, peer
 * dependencies, and hoisted/transitive deps.
 *
 * @example
 * ```typescript
 * import { TypeScript } from '\@savvy-web/lint-staged';
 *
 * export default {
 *   // Auto-detects compiler and runs type checking
 *   [TypeScript.glob]: TypeScript.handler,
 *
 *   // Or explicit config
 *   [TypeScript.glob]: TypeScript.create({
 *     skipTypecheck: true,
 *   }),
 * };
 * ```
 */
// biome-ignore lint/complexity/noStaticOnlyClass: Intentional pattern for TSDoc discoverability
export class TypeScript {
	/**
	 * Glob pattern for matching TypeScript files.
	 * @defaultValue `'*.{ts,cts,mts,tsx}'`
	 */
	static readonly glob = "*.{ts,cts,mts,tsx}";

	/**
	 * Default patterns to exclude from processing.
	 * @defaultValue `[]`
	 */
	static readonly defaultExcludes = [] as const;

	/** Cached compiler detection result */
	private static cachedCompilerResult: { compiler: TypeScriptCompiler; tool: ToolSearchResult } | null = null;

	/**
	 * Detect which TypeScript compiler to use.
	 *
	 * Uses `Command.findTool()` to check for available compilers:
	 * 1. `tsgo` (native TypeScript) — checked first
	 * 2. `tsc` (standard TypeScript) — fallback
	 *
	 * @remarks
	 * Unlike the previous implementation that parsed `package.json` dependencies,
	 * this uses runtime tool detection which works correctly with pnpm catalogs,
	 * peer dependencies, and hoisted/transitive deps.
	 *
	 * @param _cwd - Ignored (kept for backward compatibility)
	 * @returns The compiler to use, or undefined if neither is available
	 */
	static detectCompiler(_cwd?: string): TypeScriptCompiler | undefined {
		if (TypeScript.cachedCompilerResult !== null) {
			return TypeScript.cachedCompilerResult.compiler;
		}

		// Check for native TypeScript (tsgo) first
		const tsgo = Command.findTool("tsgo");
		if (tsgo.available) {
			TypeScript.cachedCompilerResult = { compiler: "tsgo", tool: tsgo };
			return "tsgo";
		}

		// Fall back to standard TypeScript (tsc)
		const tsc = Command.findTool("tsc");
		if (tsc.available) {
			TypeScript.cachedCompilerResult = { compiler: "tsc", tool: tsc };
			return "tsc";
		}

		return undefined;
	}

	/**
	 * Check if a TypeScript compiler is available.
	 *
	 * @returns `true` if either tsgo or tsc is available
	 */
	static isAvailable(): boolean {
		return TypeScript.detectCompiler() !== undefined;
	}

	/**
	 * Get the default type checking command for the detected compiler.
	 *
	 * @remarks
	 * Uses the cached `ToolSearchResult` from `detectCompiler()` to build
	 * the command string, avoiding a separate package manager detection step.
	 *
	 * @returns Command string like `pnpm exec tsgo --noEmit` or `tsgo --noEmit`
	 * @throws Error if no TypeScript compiler is available
	 */
	static getDefaultTypecheckCommand(): string {
		const compiler = TypeScript.detectCompiler();
		if (!compiler || !TypeScript.cachedCompilerResult) {
			throw new Error(
				"No TypeScript compiler found. Install 'typescript' or '@typescript/native-preview' as a dev dependency.",
			);
		}

		return `${TypeScript.cachedCompilerResult.tool.command} --noEmit`;
	}

	/**
	 * Clear the cached compiler detection result.
	 * Useful for testing or when the environment changes.
	 */
	static clearCache(): void {
		TypeScript.cachedCompilerResult = null;
	}

	/**
	 * Pre-configured handler with default options.
	 */
	static readonly handler: LintStagedHandler = TypeScript.create();

	/**
	 * Create a handler with custom options.
	 *
	 * @param options - Configuration options
	 * @returns A lint-staged compatible handler function
	 */
	static create(options: TypeScriptOptions = {}): LintStagedHandler {
		const excludes = options.exclude ?? [...TypeScript.defaultExcludes];
		const skipTypecheck = options.skipTypecheck ?? false;

		// Lazy-load typecheck command to avoid throwing during import
		let typecheckCommand: string | undefined;
		const getTypecheckCommand = (): string => {
			if (typecheckCommand === undefined) {
				typecheckCommand = options.typecheckCommand ?? TypeScript.getDefaultTypecheckCommand();
			}
			return typecheckCommand;
		};

		return (filenames: readonly string[]): string | string[] => {
			const filtered = Filter.exclude(filenames, excludes);
			if (filtered.length === 0) return [];
			if (!skipTypecheck) return [getTypecheckCommand()];
			return [];
		};
	}
}
