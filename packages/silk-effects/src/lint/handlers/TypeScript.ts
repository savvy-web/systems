/**
 * Handler for TypeScript files.
 *
 * Runs type checking with tsc or tsgo.
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
 * Runs type checking with tsc or tsgo.
 *
 * @remarks
 * Type checking runs on all staged TypeScript files using the configured
 * compiler (tsc or tsgo). The compiler is auto-detected at runtime using
 * `Command.findTool()`, which correctly handles pnpm catalogs, peer
 * dependencies, and hoisted/transitive deps.
 *
 * @example
 * ```typescript
 * import { TypeScript } from '\@savvy-web/silk/lint';
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
	 * 1. `tsc` (standard TypeScript) — checked first
	 * 2. `tsgo` (native TypeScript) — fallback
	 *
	 * @remarks
	 * `tsc` is preferred so the pre-commit gate runs the same compiler as a
	 * repo's own `types:check` task. Preferring `tsgo` meant any repo with
	 * `\@typescript/native-preview` anywhere in its dependency graph — even as
	 * a hoisted or transitive dep — silently got a different compiler for its
	 * commit gate than for its typecheck task.
	 *
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

		// Check for standard TypeScript (tsc) first
		const tsc = Command.findTool("tsc");
		if (tsc.available) {
			TypeScript.cachedCompilerResult = { compiler: "tsc", tool: tsc };
			return "tsc";
		}

		// Fall back to native TypeScript (tsgo)
		const tsgo = Command.findTool("tsgo");
		if (tsgo.available) {
			TypeScript.cachedCompilerResult = { compiler: "tsgo", tool: tsgo };
			return "tsgo";
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
	 * @returns Command string like `pnpm exec tsc --noEmit` or `tsc --noEmit`
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
