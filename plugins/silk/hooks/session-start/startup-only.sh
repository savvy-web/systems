#!/usr/bin/env bash
set -euo pipefail

# SessionStart hook (matcher: startup — fires only on fresh session start, not
# resume or compact): run the savvy commit session-start side-effect and inject
# a brief Silk-system intro plus the code-quality orientation context.
#
# Merges: commit-main.sh + lint-staged-env.sh
#
# Contract: reads SessionStart envelope on stdin; if CLAUDE_PROJECT_DIR is unset
# emits a noop and exits 0 (cannot block a SessionStart). Otherwise runs
# `savvy commit hook session-start` as a side-effect and emits additionalContext
# with a Silk-system intro and the code_quality_context block. (Design-doc
# orientation is owned by the design-docs plugin and is intentionally not
# duplicated here.)

# shellcheck source=../lib/hook-output.sh
. "${CLAUDE_PLUGIN_ROOT}/hooks/lib/hook-output.sh"
# shellcheck source=../lib/hook-debug.sh
. "${CLAUDE_PLUGIN_ROOT}/hooks/lib/hook-debug.sh"

_HOOK="session-start-startup-only"

# Drain stdin once.
cat > /dev/null

# Guard: CLAUDE_PROJECT_DIR must be set. A SessionStart cannot block, so
# emit_noop and exit 0 rather than exit 1 when the env var is absent.
if [ -z "${CLAUDE_PROJECT_DIR:-}" ]; then
	hook_error "$_HOOK" "CLAUDE_PROJECT_DIR is not set; skipping"
	emit_noop
	exit 0
fi

# Detect package manager for context block interpolation.
detect_pm() {
	local root="$CLAUDE_PROJECT_DIR"
	if [ -f "$root/package.json" ] && command -v jq >/dev/null 2>&1; then
		local pm
		pm=$(jq -r '.packageManager // empty' "$root/package.json" 2>/dev/null | cut -d'@' -f1)
		if [ -n "$pm" ]; then
			echo "$pm"
			return
		fi
	fi
	if [ -f "$root/pnpm-lock.yaml" ]; then
		echo "pnpm"
	elif [ -f "$root/yarn.lock" ]; then
		echo "yarn"
	elif [ -f "$root/bun.lock" ]; then
		echo "bun"
	else
		echo "npm"
	fi
}

PM=$(detect_pm)

case "$PM" in
	pnpm) RUN="pnpm exec" ;;
	yarn) RUN="yarn exec" ;;
	bun)  RUN="bunx" ;;
	*)    RUN="npx --no --" ;;
esac

# Side-effect: run savvy commit hook session-start via the run-cli.sh resolver.
# On failure, log the error and continue — a hook side-effect failure must never
# block the session.
if command -v jq >/dev/null 2>&1; then
	RUNNER=$(bash "${CLAUDE_PLUGIN_ROOT}/hooks/lib/run-cli.sh")
	err=$(mktemp -t silk-commit-session-start.XXXXXX)
	trap 'rm -f "$err"' EXIT
	if ! $RUNNER savvy commit hook session-start >/dev/null 2>"$err"; then
		hook_error "$_HOOK" "savvy commit hook session-start failed: $(tr '\n' ' ' < "$err")"
	fi
fi

CONTEXT=$(cat <<CONTEXT
<silk_system>
You are working in a Silk-enabled workspace — a Savvy Web Silk Suite project with
shared conventions and tooling for changesets, commits, and code quality. The
always-on session orientation explains the rest: the shared savvy MCP, the
available skills, and how to find Silk docs. This startup note carries the
project's code-quality conventions you need from the first edit.
</silk_system>

<EXTREMELY_IMPORTANT>
<code_quality_lint_rules>

These Biome and TypeScript rules are enforced at pre-commit and WILL BLOCK a
commit if violated. Apply them from the first edit — do not defer to the hook.

Biome lint rules (all Error-level):
- useImportExtensions: All relative imports MUST use .js extensions (ESM requirement)
- useImportType: Type-only imports MUST use import type { Foo }, not import { type Foo }
- useNodejsImportProtocol: Node.js built-ins MUST use node: protocol (node:fs, node:path)
- noUnusedVariables: Unused variables are an error (rest siblings excepted)
- noImportCycles: Circular imports are an error — no import cycles
- organizeImports: Imports are auto-sorted; write them in any order and Biome fixes on save

TypeScript strict flags (enabled — violations are compile errors):
- verbatimModuleSyntax: use import type for type-only imports
- exactOptionalPropertyTypes: optional properties cannot be explicitly set to undefined

</code_quality_lint_rules>
</EXTREMELY_IMPORTANT>

<reminder>
<code_quality_formatting>

Biome auto-formats on pre-commit — you do not need to hand-format. For reference:
- Indent: tabs, width 2
- Line width: 120 characters
- Format-with-errors enabled (formats even if there are parse issues)
- package.json: JSON auto-expanded; turbo.json, tsconfig*.json: keys auto-sorted
- Test files (*.test.ts): noUndeclaredDependencies is off

Markdown files are linted with markdownlint-cli2:
- No line length limit (MD013 disabled)
- Duplicate headings allowed only among siblings (MD024)
- HTML elements restricted to: br, details, summary, img, sup, sub
- Code fences must have a language identifier (MD040)
- Tables must use compact style (MD060) — single space around cell content
- Files must end with a single newline (MD047)

TypeScript base config (non-blocking, for reference):
- Target: ES2023, Module: NodeNext; strict + strictNullChecks; isolatedModules; esModuleInterop

</code_quality_formatting>

<running_tools>
If you need to check or fix code quality manually:
- ${RUN} biome check — check all files with Biome
- ${RUN} biome check --write — auto-fix lint issues
- ${RUN} markdownlint-cli2 --config lib/configs/.markdownlint-cli2.jsonc — check markdown files
- ${RUN} lint-staged --config "${CLAUDE_PROJECT_DIR}/lib/configs/lint-staged.config.ts" — run lint-staged manually
- pnpm run typecheck — type-check with tsgo
</running_tools>

<pre_commit_hook>
Lint-staged runs automatically on pre-commit via Husky. The hook uses the
detected package manager (${PM}) and config at lib/configs/lint-staged.config.ts.
</pre_commit_hook>
</reminder>
CONTEXT
)

emit_context "SessionStart" "$CONTEXT"
