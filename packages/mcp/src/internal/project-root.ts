/**
 * Pure resolution of the MCP server's project working directory.
 *
 * @packageDocumentation
 */

/**
 * Resolves the project directory the MCP server should root its runtime in.
 *
 * @remarks
 * Precedence: a non-empty, non-placeholder `argv[0]`, then
 * `env.SAVVY_MCP_PROJECT_DIR`, then `env.CLAUDE_PROJECT_DIR`, then `cwd()`. A
 * `${...}`-shaped `argv[0]` is an unresolved template placeholder (an MCP
 * client that failed to substitute a config variable) and is ignored, as is
 * a whitespace-only value. Takes `argv`/`env`/`cwd` as parameters rather than
 * reading `process` directly so it stays pure and unit-testable; `main.ts` is
 * the sole caller and supplies the real process bindings.
 */
export function resolveProjectDir(argv: ReadonlyArray<string>, env: NodeJS.ProcessEnv, cwd: () => string): string {
	const raw = argv[0];
	const trimmed = raw?.trim();
	const fromArgv =
		trimmed !== undefined && trimmed.length > 0 && !(trimmed.startsWith("${") && trimmed.endsWith("}"))
			? trimmed
			: undefined;
	return fromArgv ?? env.SAVVY_MCP_PROJECT_DIR ?? env.CLAUDE_PROJECT_DIR ?? cwd();
}
