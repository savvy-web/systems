/**
 * Utilities for shell command operations.
 *
 * @example
 * ```typescript
 * import { Command } from '@savvy-web/silk/lint';
 *
 * if (Command.isAvailable('yq')) {
 *   // yq is installed globally
 * }
 *
 * // Check for tool available globally OR via package manager
 * const biome = Command.findTool('biome');
 * if (biome.available) {
 *   console.log(`Using: ${biome.command}`); // 'biome' or 'pnpm exec biome'
 * }
 *
 * // Detect package manager from package.json
 * const pm = Command.detectPackageManager();
 * console.log(pm); // 'pnpm', 'npm', 'yarn', or 'bun'
 * ```
 */

import { execSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import type { ExecContext, ToolDiscoverySync } from "@effected/commands";
import { LocalExec, Tool, makeToolDiscoverySync } from "@effected/commands";
import { nodeSpawnSync } from "@effected/commands/node-sync";
import { detectPackageManagerSync } from "@effected/workspaces";
import { nodeSyncOps } from "@effected/workspaces/node-sync";
import { Result } from "effect";

/**
 * Supported package managers.
 */
export type PackageManager = "npm" | "pnpm" | "yarn" | "bun";

/**
 * Result of a tool search.
 */
export interface ToolSearchResult {
	/** Whether the tool is available */
	available: boolean;
	/** The command to use (e.g., 'biome' or 'pnpm exec biome') */
	command: string | undefined;
	/** Where the tool was found: 'global', package manager name, or undefined */
	source: "global" | PackageManager | undefined;
}

/** Pattern for valid command/tool names (alphanumeric, hyphens, underscores, \@, /) */
const VALID_COMMAND_PATTERN = /^[\w@/-]+$/;

/**
 * Validate that a command name is safe for shell execution.
 * Prevents command injection by ensuring only valid characters are used.
 *
 * @param name - The command or tool name to validate
 * @throws Error if the name contains invalid characters
 */
function validateCommandName(name: string): void {
	if (!VALID_COMMAND_PATTERN.test(name)) {
		throw new Error(
			`Invalid command name: "${name}". Only alphanumeric characters, hyphens, underscores, @ and / are allowed.`,
		);
	}
}

/**
 * Static utility class for shell command operations.
 */
export class Command {
	/** Cached package manager detection result */
	private static cachedPackageManager: PackageManager | null = null;

	/** Cached project root path */
	private static cachedRoot: string | null = null;

	/** Memoizing tool discovery, created lazily and dropped by `clearCache` */
	private static discovery: ToolDiscoverySync | null = null;

	private static getDiscovery(): ToolDiscoverySync {
		if (Command.discovery === null) {
			const context: ExecContext = LocalExec.contextFor(Command.detectPackageManager(), {
				directory: Command.findRoot(),
			});
			Command.discovery = makeToolDiscoverySync({ spawn: nodeSpawnSync, context });
		}
		return Command.discovery;
	}

	/**
	 * Find the project root directory by walking up from `cwd`.
	 *
	 * Searches upward for the nearest directory containing a `package.json`.
	 * Falls back to the provided `cwd` (or `process.cwd()`) when none is found.
	 *
	 * @remarks
	 * This is more reliable than `process.cwd()` in environments like Husky
	 * hooks where the working directory may point to `.husky/` or another
	 * subdirectory.
	 *
	 * @param cwd - Starting directory for the search (defaults to `process.cwd()`)
	 * @returns The resolved project root path
	 *
	 * @example
	 * ```typescript
	 * const root = Command.findRoot();
	 * console.log(root); // '/Users/me/my-project'
	 * ```
	 */
	static findRoot(cwd: string = process.cwd()): string {
		if (Command.cachedRoot !== null) {
			return Command.cachedRoot;
		}

		let dir = resolve(cwd);
		while (true) {
			if (existsSync(join(dir, "package.json"))) {
				Command.cachedRoot = dir;
				return dir;
			}
			const parent = dirname(dir);
			if (parent === dir) break;
			dir = parent;
		}

		Command.cachedRoot = cwd;
		return cwd;
	}

	/**
	 * Detect the package manager declared by the root package.json.
	 *
	 * Delegates to the kit's `detectPackageManagerSync` (manifest fields, then workspace and
	 * lockfile markers) at `cwd` without walking up. Falls back to "npm" when none names a manager.
	 *
	 * @param cwd - Directory to search for package.json (defaults to `Command.findRoot()`)
	 * @returns The detected package manager
	 *
	 * @example
	 * ```typescript
	 * const pm = Command.detectPackageManager();
	 * console.log(pm); // 'pnpm', 'npm', 'yarn', or 'bun'
	 * ```
	 */
	static detectPackageManager(cwd: string = Command.findRoot()): PackageManager {
		// Return cached result if available
		if (Command.cachedPackageManager !== null) {
			return Command.cachedPackageManager;
		}

		const detected = detectPackageManagerSync(cwd, nodeSyncOps);
		Command.cachedPackageManager = Result.isSuccess(detected) ? detected.success.name : "npm";
		return Command.cachedPackageManager;
	}

	/**
	 * Get the exec command prefix for a package manager.
	 *
	 * @param packageManager - The package manager name
	 * @returns Array of command parts to prefix tool execution
	 *
	 * @example
	 * ```typescript
	 * Command.getExecPrefix('pnpm'); // ['pnpm', 'exec']
	 * Command.getExecPrefix('npm');  // ['npx', '--no', '--']
	 * Command.getExecPrefix('yarn'); // ['yarn', 'exec']
	 * Command.getExecPrefix('bun');  // ['bun', 'x', "--no-install"]
	 * ```
	 */
	static getExecPrefix(packageManager: PackageManager): string[] {
		return [...LocalExec.contextFor(packageManager).prefix];
	}

	/**
	 * Clear the cached package manager and project root detection.
	 * Useful for testing or when package.json changes.
	 */
	static clearCache(): void {
		Command.cachedPackageManager = null;
		Command.cachedRoot = null;
		Command.discovery?.invalidateAll();
		Command.discovery = null;
	}

	/**
	 * Check if a command is available in the system PATH.
	 *
	 * @param command - The command name to check
	 * @returns `true` if the command exists, `false` otherwise
	 *
	 * @example
	 * ```typescript
	 * if (Command.isAvailable('yq')) {
	 *   console.log('yq is installed');
	 * }
	 * ```
	 */
	static isAvailable(command: string): boolean {
		validateCommandName(command);
		return Command.getDiscovery().isAvailable(Tool.named(command, { source: "global" }));
	}

	/**
	 * Find a tool, checking global installation first, then the project's package manager.
	 *
	 * Search order:
	 * 1. Global command (in PATH)
	 * 2. Project's package manager (detected from package.json `devEngines.packageManager`, `packageManager`, or a lockfile)
	 *
	 * @param tool - The tool name to find
	 * @returns Search result with command string if found
	 *
	 * @example
	 * ```typescript
	 * const biome = Command.findTool('biome');
	 * if (biome.available) {
	 *   // biome.command is 'biome', 'pnpm exec biome', 'npx --no biome', etc.
	 *   console.log(`Running: ${biome.command} check`);
	 * }
	 * ```
	 */
	static findTool(tool: string): ToolSearchResult {
		validateCommandName(tool);

		const resolved = Command.getDiscovery().resolve(Tool.named(tool, { prefer: "global" }));
		if (Result.isFailure(resolved)) {
			return { available: false, command: undefined, source: undefined };
		}
		const found = resolved.success;
		return {
			available: true,
			command: found.argv().join(" "),
			source: found.source === "global" ? "global" : Command.detectPackageManager(),
		};
	}

	/**
	 * Find a tool or throw an error if not available.
	 *
	 * @param tool - The tool name to find
	 * @param errorMessage - Custom error message (optional)
	 * @returns The command string to use
	 * @throws Error if the tool is not available
	 *
	 * @example
	 * ```typescript
	 * const biomeCmd = Command.requireTool('biome');
	 * // Throws if biome not found, otherwise returns command string
	 * ```
	 */
	static requireTool(tool: string, errorMessage?: string): string {
		const result = Command.findTool(tool);
		if (!result.available || !result.command) {
			throw new Error(
				errorMessage ?? `Required tool '${tool}' is not available. Install it globally or add it as a dev dependency.`,
			);
		}
		return result.command;
	}

	/**
	 * Find the `savvy lint` CLI command.
	 *
	 * @remarks
	 * Resolves the unified `savvy` binary via the standard tool search and
	 * appends the `lint` subcommand, falling back to the cli dev build at
	 * `packages/cli/dist/dev/pkg/bin/savvy.js` for dogfooding scenarios where the
	 * bin isn't linked yet.
	 *
	 * @returns The command string to invoke `savvy lint`
	 */
	static findSavvyLint(): string {
		const result = Command.findTool("savvy");
		if (result.available && result.command) {
			return `${result.command} lint`;
		}

		// Fallback for dogfooding: use the cli dev build directly
		const root = Command.findRoot();
		return `node ${root}/packages/cli/dist/dev/pkg/bin/savvy.js lint`;
	}

	/**
	 * Execute a command and return its output.
	 *
	 * @deprecated No in-repo consumers; will be removed in a future major.
	 *
	 * @param command - The command to execute
	 * @returns The command output as a string (trimmed)
	 * @throws If the command fails
	 *
	 * @example
	 * ```typescript
	 * const version = Command.exec('node --version');
	 * console.log(version); // 'v20.10.0'
	 * ```
	 */
	static exec(command: string): string {
		return execSync(command, { encoding: "utf-8" }).trim();
	}

	/**
	 * Execute a command silently (ignore output).
	 *
	 * @deprecated No in-repo consumers; will be removed in a future major.
	 *
	 * @param command - The command to execute
	 * @returns `true` if successful, `false` if failed
	 */
	static execSilent(command: string): boolean {
		try {
			execSync(command, { stdio: "ignore" });
			return true;
		} catch {
			return false;
		}
	}
}
