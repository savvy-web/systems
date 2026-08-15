#!/usr/bin/env bash
set -euo pipefail

# SessionStart hook (matcher: startup — fires only on fresh session start, not
# resume or compact): run the savvy commit session-start side-effect and inject
# a brief Silk-system intro plus the code-quality orientation context.
#
# Merges: commit-main.sh + lint-staged-env.sh
#
# Contract: reads the SessionStart envelope on stdin and resolves the working
# tree through resolve_project_dir (envelope .cwd first — worktree-correct, see
# savvy-web/systems#274); if no project dir resolves at all it emits a noop and
# exits 0 (cannot block a SessionStart). Otherwise runs `savvy commit hook
# session-start` as a side-effect and emits additionalContext with a Silk-system
# intro, the lint-rule contract, the pre-commit lint-staged pipeline (including
# the intentional exec-bit strip), and the LSP-first tool preference order.
# (Design-doc orientation is owned by the design-docs plugin and is intentionally
# not duplicated here.)
#
# Unlike the other jq-parsing hooks this one does NOT call read_envelope_or_noop:
# a malformed body must still emit the code-quality context (it is unconditional
# session orientation, not a decision about a tool call). resolve_project_dir
# tolerates a non-JSON envelope — its jq call is guarded — and simply falls back
# to SILK_PROJECT_DIR / CLAUDE_PROJECT_DIR.

# shellcheck source=../lib/hook-output.sh
. "${CLAUDE_PLUGIN_ROOT}/hooks/lib/hook-output.sh"
# shellcheck source=../lib/hook-debug.sh
. "${CLAUDE_PLUGIN_ROOT}/hooks/lib/hook-debug.sh"
# shellcheck source=../lib/hook-env.sh
. "${CLAUDE_PLUGIN_ROOT}/hooks/lib/hook-env.sh"

_HOOK="session-start-startup-only"

# Drain stdin once, keeping the body so the project dir can be resolved from it.
ENVELOPE=$(cat)

PROJECT_DIR=$(resolve_project_dir "$ENVELOPE")

# Guard: a project dir must resolve from somewhere. A SessionStart cannot block,
# so emit_noop and exit 0 rather than exit 1 when nothing resolves.
if [ -z "$PROJECT_DIR" ]; then
	hook_error "$_HOOK" "no project dir (envelope cwd / SILK_PROJECT_DIR / CLAUDE_PROJECT_DIR all unset); skipping"
	emit_noop
	exit 0
fi

# Package-manager detection is shared with orientation.sh via hook-env.sh.
PM=$(detect_package_manager "$PROJECT_DIR")
RUN=$(package_manager_exec "$PM")

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
You are working in a Silk-enabled workspace. The always-on orientation lists the
plugin's MCP tools, agents and skills — use them. This startup note carries the
code-quality contract you need from your FIRST edit.
</silk_system>

<EXTREMELY_IMPORTANT>
<code_quality_lint_rules>

These Biome and TypeScript rules are enforced at pre-commit and WILL BLOCK a
commit if violated. Apply them from the first edit — do not defer to the hook.

Biome lint rules (all Error-level):
- useImportExtensions: relative imports MUST carry an explicit extension — TS-family sources use their emitted form (.ts/.tsx -> .js, .mts -> .mjs, .cts -> .cjs); asset imports (.json, .css) keep their real extension
- useImportType: Type-only imports MUST use import type { Foo }, not import { type Foo }
- useNodejsImportProtocol: Node.js built-ins MUST use node: protocol (node:fs, node:path)
- noUnusedVariables: Unused variables are an error (rest siblings excepted)
- noImportCycles: Circular imports are an error — no import cycles
- organizeImports: Imports are auto-sorted; write them in any order, Biome fixes them

TypeScript strict flags (enabled — violations are compile errors):
- verbatimModuleSyntax: use import type for type-only imports
- exactOptionalPropertyTypes: optional properties cannot be explicitly set to undefined

</code_quality_lint_rules>
</EXTREMELY_IMPORTANT>

<pre_commit_pipeline>

Husky runs lint-staged (lib/configs/lint-staged.config.ts -> Preset.silk()) over
STAGED files on every commit. It AUTOFIXES most things and re-stages the result.
Know what it does so you neither duplicate it nor misread it as damage:

  package.json          sort-package-json, then biome check --write
  *.{js,ts,cjs,mjs,jsx,tsx,json,jsonc,d.cts,d.mts}
                        biome check --write — formats, applies safe fixes,
                        organizes imports
  *.{md,mdx}            markdownlint-cli2 --fix
  *.{yml,yaml}          savvy lint fmt yaml
  pnpm-workspace.yaml   savvy lint fmt pnpm-workspace
  *.sh                  chmod -x  <- STRIPS THE EXECUTABLE BIT
  *.{ts,cts,mts,tsx}    tsgo --noEmit (or tsc --noEmit) — BLOCKING, no autofix.
                        A type error fails the commit. Nothing else here will.

Two consequences, both of which agents get wrong:

1. DO NOT HAND-FORMAT. Do not hand-sort imports, hand-wrap lines, hand-order
   package.json keys, or run a formatting pass "to be safe". Formatting is
   applied for you at commit time. Write correct code; let the hook style it.

2. THE EXEC-BIT STRIP IS INTENTIONAL — NOT MODE DRIFT, NOT A BUG.
   Committed .sh files land as 100644, never 100755 (the sole exception is
   .claude/scripts/, which the handler excludes). Every shell script in this
   repo — plugin hooks, the bats runner — is invoked as \`bash <script>\`, so
   nothing needs the exec bit at runtime. Writing an executable script is fine:
   chmod +x and run it; the commit simply normalizes the mode back to 644, and
   you can flip it again if you need to re-run it. Expect that flip — it is
   standard behavior, not damage. Do NOT "fix" a 755-to-644 mode change in a
   diff, do NOT flag it in a review, and do NOT open an issue about it. This is
   documented in savvy-web/systems#289 and in the header comment of
   lint-staged.config.ts.

</pre_commit_pipeline>

<reminder>
<code_quality_formatting>

For reference (all applied automatically — see above):
- Indent: tabs, width 2; line width 120; format-with-errors enabled
- package.json auto-expanded; turbo.json / tsconfig*.json keys auto-sorted
- Test files (*.test.ts): noUndeclaredDependencies is off

Markdown (markdownlint-cli2):
- No line-length limit (MD013 off); duplicate headings only among siblings (MD024)
- HTML restricted to: br, details, summary, img, sup, sub
- Code fences require a language (MD040); compact tables (MD060); single
  trailing newline (MD047)

TypeScript base: ES2023 / NodeNext; strict + strictNullChecks; isolatedModules;
esModuleInterop.

</code_quality_formatting>

<running_tools>
Preference order when you need to check or fix code quality:

1. Biome LSP — automatic. Edit a file, read the diagnostics you are handed. No
   command needed. Do not run Biome just to look at a file you just edited.
2. mcp__plugin_silk_savvy-mcp__biome_check — for anything wider than one file,
   and for EVERY fix pass: paths[], mode:"check"|"lint", write:true (safe fixes),
   unsafe:true, strict:true. Structured diagnostics, not stdout you have to parse.
3. Bash — direct Biome is DENIED, not merely nudged: it does not resolve
   this repo's config, so it will lint .repos/** vendored submodules and can
   corrupt them. The sanctioned Bash path is one of the three root scripts,
   through any package manager:
     ${PM} run lint   /   ${PM} run lint:fix   /   ${PM} run lint:fix:unsafe
     ${PM} run lint:md   /   ${PM} run lint:md:fix     (markdownlint-cli2)
     ${PM} run typecheck                               (turbo run types:check)
     ${RUN} lint-staged --config "${PROJECT_DIR}/lib/configs/lint-staged.config.ts"
</running_tools>
</reminder>
CONTEXT
)

emit_context "SessionStart" "$CONTEXT"
