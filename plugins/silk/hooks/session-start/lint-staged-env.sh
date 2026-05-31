#!/usr/bin/env bash
set -euo pipefail

# SessionStart hook: inform the agent about available code quality tools
# and conventions enforced by @savvy-web/lint-staged.
# Outputs JSON with additionalContext so the agent understands the workflow.

# Error trap: surface failures instead of silently producing no output
trap 'echo "ERROR: session-start.sh failed at line $LINENO (exit $?)" >&2; exit 1' ERR

# Consume stdin to prevent broken pipe errors
cat > /dev/null

if [ -z "${CLAUDE_PROJECT_DIR:-}" ]; then
  echo "ERROR: CLAUDE_PROJECT_DIR is not set" >&2
  exit 1
fi

# Detect package manager from package.json or lockfiles
detect_pm() {
  local root="$CLAUDE_PROJECT_DIR"
  if [ -f "$root/package.json" ]; then
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

# Build the context as a variable, then wrap in JSON
CONTEXT=$(cat <<CONTEXT
<EXTREMELY_IMPORTANT>
<design_documentation_system>

After completing implementation work, delegate design doc updates to the
design-doc-agent. Do not edit design docs directly — the agent knows
the system's conventions and will handle frontmatter, cross-references,
and validation.

<what_design_docs_are>
Design docs record the current state of implementation: architecture
decisions, system boundaries, data flows, and the reasoning behind
design choices. They live in .claude/design/ with implementation
plans in .claude/plans/.
</what_design_docs_are>

<why_they_matter>
Design docs are this project's institutional memory. Without them,
every new session starts from zero — re-reading code to understand
intent that was already documented. Keeping them current after
implementation work is as important as the implementation itself.
</why_they_matter>

<when_to_update>
Update design docs when you have:
- Added or changed system architecture
- Modified data flows or API boundaries
- Made decisions that future sessions should know about
- Completed work described in an implementation plan
</when_to_update>

<how_to_update>
Delegate to specialized agents rather than editing directly:
- design-doc-agent — design docs and implementation plans
- context-doc-agent — CLAUDE.md context files
- docs-gen-agent — user-facing documentation (READMEs, etc.)
</how_to_update>

<available_skills>
  <command_group name="Design docs">
    /design-docs:design-init, design-validate, design-update, design-sync, design-review, design-audit, design-search, design-compare, design-link, design-index, design-report, design-export, design-archive, design-prune, design-config
  </command_group>
  <command_group name="Plans">
    /design-docs:plan-create, plan-validate, plan-list, plan-explore, plan-complete
  </command_group>
  <command_group name="Context">
    /design-docs:context-validate, context-audit, context-review, context-update, context-split
  </command_group>
  <command_group name="User docs">
    /design-docs:docs-generate-readme, docs-generate-repo, docs-generate-site, docs-generate-contributing, docs-generate-security, docs-review, docs-review-package, docs-sync, docs-update
  </command_group>
  <command_group name="Finalization">
    /design-docs:finalize — end-of-branch workflow (update all docs, create changeset, commit, push, open PR)
  </command_group>
</available_skills>

</design_documentation_system>

<code_quality_context>

This project uses automated code quality tools via @savvy-web/lint-staged.
These tools run automatically on pre-commit via Husky hooks. Follow these
conventions to avoid lint failures.

<biome_formatting>
Biome handles formatting and linting for TypeScript, JavaScript, JSON, and CSS.

Formatting rules:
- Indent with tabs, width 2
- Line width: 120 characters
- Format-with-errors enabled (formats even if there are syntax issues)

Key linting enforcements:
- useImportExtensions: All relative imports MUST use .js extensions (ESM requirement)
- useImportType: Separate type imports required (import type { Foo } not import { type Foo })
- useNodejsImportProtocol: Node.js built-ins must use node: protocol (node:fs, node:path)
- useConsistentTypeDefinitions: Use consistent type definitions (interfaces)
- noUnusedVariables: Error (rest siblings ignored)
- noImportCycles: Error — no circular imports
- organizeImports: Imports auto-sorted lexicographically

Overrides:
- package.json: JSON auto-expanded
- turbo.json, tsconfig*.json: Keys auto-sorted
- Test files (*.test.ts): noUndeclaredDependencies is off

Ignored paths: dist, .turbo, .git, .rslib, .vitest, .coverage, coverage,
__test__/**/fixtures, __test__/**/snapshots, __fixtures__
</biome_formatting>

<markdown_linting>
All markdown files are linted with markdownlint-cli2.

Key rules:
- No line length limit (MD013 disabled)
- Duplicate headings allowed only among siblings (MD024)
- HTML elements restricted to: br, details, summary, img, sup, sub
- Code fences must have a language identifier (MD040)
- Tables must use compact style (MD060) — single space around cell content
- Files must end with a single newline (MD047)
- All other default markdownlint rules are enabled

Ignored paths: node_modules, dist, CHANGELOG.md, .claude/plans, docs/superpowers
</markdown_linting>

<typescript_config>
Standard strict TypeScript configuration:
- Target: ES2023, Module: NodeNext
- Strict mode enabled with strictNullChecks
- exactOptionalPropertyTypes: enabled — optional properties cannot be explicitly set to undefined
- verbatimModuleSyntax: enabled — use import type for type-only imports
- isolatedModules: enabled
- esModuleInterop: enabled
</typescript_config>

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

</code_quality_context>
</EXTREMELY_IMPORTANT>
CONTEXT
)

# Output as JSON with additionalContext
jq -n --arg ctx "$CONTEXT" '{
  "hookSpecificOutput": {
    "hookEventName": "SessionStart",
    "additionalContext": $ctx
  }
}'

exit 0
