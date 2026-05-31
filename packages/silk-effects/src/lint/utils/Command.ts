/**
 * Utilities for shell command operations.
 *
 * @example
 * ```typescript
 * import { Command } from '@savvy-web/lint-staged';
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
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

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
// biome-ignore lint/complexity/noStaticOnlyClass: Intentional pattern for TSDoc discoverability
export class Command {
	/** Cached package manager detection result */
	private static cachedPackageManager: PackageManager | null = null;

	/** Cached project root path */
	private static cachedRoot: string | null = null;

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
	 * Detect the package manager from the root package.json's `packageManager` field.
	 *
	 * Parses the `packageManager` field (e.g., `pnpm\@9.0.0`) and extracts the manager name.
	 * Falls back to "npm" if no packageManager field is found.
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

		const packageJsonPath = join(cwd, "package.json");

		if (!existsSync(packageJsonPath)) {
			Command.cachedPackageManager = "npm";
			return "npm";
		}

		try {
			const content = readFileSync(packageJsonPath, "utf-8");
			const pkg = JSON.parse(content) as { packageManager?: string };

			if (pkg.packageManager) {
				// Parse "pnpm@9.0.0" -> "pnpm"
				const match = pkg.packageManager.match(/^(npm|pnpm|yarn|bun)@/);
				if (match) {
					Command.cachedPackageManager = match[1] as PackageManager;
					return Command.cachedPackageManager;
				}
			}
		} catch {
			// Failed to read or parse package.json
		}

		Command.cachedPackageManager = "npm";
		return "npm";
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
	 * Command.getExecPrefix('npm');  // ['npx', '--no']
	 * Command.getExecPrefix('yarn'); // ['yarn', 'exec']
	 * Command.getExecPrefix('bun');  // ['bun', 'x', "--no-install"]
	 * ```
	 */
	static getExecPrefix(packageManager: PackageManager): string[] {
		switch (packageManager) {
			case "pnpm":
				return ["pnpm", "exec"];
			case "yarn":
				return ["yarn", "exec"];
			case "bun":
				return ["bun", "x", "--no-install"];
			default:
				return ["npx", "--no"];
		}
	}

	/**
	 * Clear the cached package manager and project root detection.
	 * Useful for testing or when package.json changes.
	 */
	static clearCache(): void {
		Command.cachedPackageManager = null;
		Command.cachedRoot = null;
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
		try {
			execSync(`command -v ${command}`, { stdio: "ignore" });
			return true;
		} catch {
			return false;
		}
	}

	/**
	 * Find a tool, checking global installation first, then the project's package manager.
	 *
	 * Search order:
	 * 1. Global command (in PATH)
	 * 2. Project's package manager (detected from package.json `packageManager` field)
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

		// Check global first (preferred)
		if (Command.isAvailable(tool)) {
			return { available: true, command: tool, source: "global" };
		}

		// Detect and use the project's package manager
		const pm = Command.detectPackageManager();
		const prefix = Command.getExecPrefix(pm);
		const execCmd = [...prefix, tool].join(" ");

		try {
			// Check if the tool is available via the package manager
			execSync(`${execCmd} --version`, { stdio: "ignore" });
			return { available: true, command: execCmd, source: pm };
		} catch {
			// Not available via package manager
		}

		return { available: false, command: undefined, source: undefined };
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
	 * `packages/cli/dist/dev/bin/cli.js` for dogfooding scenarios where the
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
		return `node ${root}/packages/cli/dist/dev/bin/cli.js lint`;
	}

	/**
	 * Execute a command and return its output.
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
