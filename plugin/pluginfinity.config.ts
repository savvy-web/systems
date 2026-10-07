import { defineConfig } from "pluginfinity";

/**
 * The silk plugin, built for Claude Code and GitHub Copilot from one source.
 *
 * The plugin name, the `savvy-mcp` MCP server key and the `biome` LSP key are
 * load-bearing: Claude Code names this plugin's MCP tools
 * `mcp__plugin_silk_savvy-mcp__<tool>`, and skills, agents and hooks spell
 * them that way.
 */
export default defineConfig({
	name: "silk",
	description:
		"Companion plugin for @savvy-web/silk — changeset, commit, lint, and Turborepo conventions, skills, and agents for the Silk Suite",
	author: { name: "C. Spencer Beggs", email: "spencer@savvyweb.systems", url: "https://savvyweb.systems" },
	homepage: "https://github.com/savvy-web/systems",
	repository: "https://github.com/savvy-web/systems.git",
	license: "MIT",
	keywords: ["silk-suite", "changesets", "commitlint", "lint-staged", "biome", "code-quality", "turborepo"],
	scripts: { invoke: "bash" },
	// Session variables, resolved once per SessionStart by the generated runner
	// (lib/pluginfinity/env-run.sh) and applied before every hook body. The
	// defaults are empty so each reader's detect-when-empty fallback still runs.
	// SILK_PROJECT_DIR is deliberately NOT declared: every declared name is
	// appended to CLAUDE_ENV_FILE, which would pin the skill scripts to the
	// session-start tree (resolve-cli-project-dir.sh rule 2).
	// SILK_REPOS_SYNC_TIMEOUT stays ambient-only.
	env: {
		prefix: "SILK",
		vars: {
			SILK_PACKAGE_MANAGER: {
				default: "",
				description: "The project's package manager (pnpm, yarn, bun or npm), detected by scripts/env-setup.sh",
			},
			SILK_SKIP_CHANGESET_NUDGE: {
				default: "",
				description: "Set to 1, true, yes or on to silence the Stop-time missing-changeset note",
			},
		},
		setup: "scripts/env-setup.sh",
	},
	hooks: {
		SessionStart: [
			{ script: "hooks/session-start/orientation.sh", timeout: 5 },
			{ matcher: "startup", script: "hooks/session-start/startup-only.sh", timeout: 10 },
			{ script: "hooks/session-start/repos-orientation.sh", timeout: 10 },
		],
		PreToolUse: [
			{ matcher: "Bash", script: "hooks/pre-tool-use/commit-bash.sh", timeout: 15 },
			{ matcher: "Bash", script: "hooks/pre-tool-use/biome-prefer-mcp.sh", timeout: 5 },
			{ matcher: "Bash", script: "hooks/pre-tool-use/biome-direct-deny.sh", timeout: 5, failClosed: true },
			{ matcher: "Bash", script: "hooks/pre-tool-use/repos-bash-guard.sh", timeout: 5, failClosed: true },
			{
				matcher: "mcp__(gk|gitkraken|GitKraken)__.*|mcp__github(-[^_].*)?__.*",
				script: "hooks/pre-tool-use/commit-mcp.sh",
				timeout: 5,
			},
			{
				matcher: "mcp__(gk|gitkraken|GitKraken)__.*|mcp__github(-[^_].*)?__.*",
				script: "hooks/pre-tool-use/repos-mcp-guard.sh",
				timeout: 5,
				failClosed: true,
			},
			{ matcher: "Read|Write|Edit", script: "hooks/pre-tool-use/commit-fs.sh", timeout: 5 },
			{ matcher: "Bash", script: "hooks/pre-tool-use/dogfood-guard.sh", timeout: 5, failClosed: true },
			{
				matcher: "mcp__(gk|gitkraken|GitKraken)__.*|mcp__github(-[^_].*)?__.*",
				script: "hooks/pre-tool-use/dogfood-guard.sh",
				timeout: 5,
				failClosed: true,
			},
			{
				matcher: "Write|Edit|NotebookEdit",
				script: "hooks/pre-tool-use/repos-fs-guard.sh",
				timeout: 5,
				failClosed: true,
			},
		],
		PostToolUse: [
			{ matcher: "Write|Edit", script: "hooks/post-tool-use/changeset-validate-changeset.sh", timeout: 15 },
			{ matcher: "Bash", script: "hooks/post-tool-use/commit-bash.sh", timeout: 15 },
		],
		Stop: [{ script: "hooks/stop/changeset-nudge.sh", timeout: 5 }],
	},
	mcpServers: {
		// biome-ignore lint/suspicious/noTemplateCurlyInString: pluginfinity placeholder
		"savvy-mcp": { command: "sh", args: ["${PLUGIN_ROOT}/bin/start-mcp.sh"] },
	},
	lspServers: {
		biome: {
			command: "sh",
			// biome-ignore lint/suspicious/noTemplateCurlyInString: pluginfinity placeholder
			args: ["${PLUGIN_ROOT}/bin/biome-lsp.sh"],
			extensionToLanguage: {
				".cjs": "javascript",
				".css": "css",
				".cts": "typescript",
				".gql": "graphql",
				".graphql": "graphql",
				".js": "javascript",
				".json": "json",
				".jsonc": "jsonc",
				".jsx": "javascriptreact",
				".mjs": "javascript",
				".mts": "typescript",
				".ts": "typescript",
				".tsx": "typescriptreact",
			},
		},
	},
	// Background monitors. Claude Code gets monitors/monitors.json; Copilot has
	// no monitors (one monitor-omitted note each). They are node scripts, so they
	// are command entries; ${PLUGIN_ROOT} becomes ${CLAUDE_PLUGIN_ROOT}.
	monitors: {
		"tsdoc-diagnostics": {
			description: "Surfaces ae-*/tsdoc- diagnostics from dist/<target>/issues.json as builds change them",
			// biome-ignore lint/suspicious/noTemplateCurlyInString: pluginfinity placeholder
			command: 'node "${PLUGIN_ROOT}/monitors/watch-issues.mjs"',
		},
		"dogfood-mail": {
			description:
				"Surfaces incoming .claude/dogfood/ mail and journal turn-flips (ball changes) as they land, filesystem-only",
			// biome-ignore lint/suspicious/noTemplateCurlyInString: pluginfinity placeholder
			command: 'node "${PLUGIN_ROOT}/monitors/dogfood-mail.mjs"',
		},
		"gitmodules-drift": {
			description:
				"Notifies when `savvy repos status --drift --json` reports drift after .gitmodules or .repos/config.json changes",
			// biome-ignore lint/suspicious/noTemplateCurlyInString: pluginfinity placeholder
			command: 'node "${PLUGIN_ROOT}/monitors/gitmodules-drift.mjs"',
		},
	},
	claude: true,
	copilot: true,
});
