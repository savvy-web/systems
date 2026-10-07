---
type: Measurement
title: The pluginfinity Claude build matches plugins/silk except for listed, intended differences
description: "Compared 2026-10-06/07 at pluginfinity 0.3.0: plugin/builds/claude carries every plugins/silk manifest field, the same 16 hook registrations, byte-identical SessionStart context and 40 of 42 byte-identical skill and agent files; every other difference is intended and listed here."
status: draft
tags: [tooling, build]
stale_after: 2027-01-05T00:00:00Z
justifies:
  - ../decisions/adopt-pluginfinity-one-source-two-hosts.md
sources:
  - id: fidelity-diff
    resource: "fidelity comparison of plugin/builds/claude against plugins/silk, kept through pluginfinity dogfood rounds 1-3 and folded into this bundle"
    author: human:spencer
    last_modified: 2026-10-07T00:00:00Z
  - id: config
    resource: ../../plugin/pluginfinity.config.ts
  - id: built-hooks
    resource: ../../plugin/builds/claude/hooks/hooks.json
  - id: built-manifest
    resource: ../../plugin/builds/claude/.claude-plugin/plugin.json
  - id: hook-env
    resource: ../../plugin/hooks/lib/silk/hook-env.sh
generated:
  by: okfit/claude-code
  at: 2026-10-07T16:26:44Z
  body_sha256: 784eb5d60fc7125b7f582a6608e5dc8fa0cc4c712351035d70af190bbed02479
---

# The pluginfinity Claude build matches plugins/silk except for listed, intended differences

## What was measured

Whether `plugin/builds/claude/`, built by pluginfinity 0.3.0 from `plugin/`, is the same Claude Code plugin as the hand-written `plugins/silk/` it replaces. The comparison was kept through the three dogfood rounds of 2026-10-06/07. It used three methods:

- a mechanical field-by-field comparison of the manifests and hook registrations;
- running both trees' SessionStart scripts on one input and comparing the `additionalContext` bytes, with and without `TERM_PROGRAM=iTerm.app` and a stub `it2`;
- a frontmatter-stripped diff of every skill and agent after token expansion.

The difference list below is complete: anything not in it matched.[^fidelity-diff] Re-run the comparison before the release branch deletes `plugins/silk/`, and treat this concept as history once it is gone.

## Results

**Manifest.** Every field of the old `plugin.json` is in the built manifest with the same value: `name`, `version`, `description`, `author`, `homepage`, `repository`, `license`, `keywords`, `mcpServers.savvy-mcp` and `lspServers.biome` (the same 13-entry `extensionToLanguage`). The plugin name and both server keys are unchanged, so the tool names `mcp__plugin_silk_savvy-mcp__*` are unchanged. Neither manifest has a `monitors` key: Claude Code discovers `monitors/monitors.json` at the plugin root.[^built-manifest]

**Hooks.** The 16 registrations match one for one, in order: event, matcher, timeout and script. That is SessionStart ×3 with `startup` on the second, PreToolUse ×10, PostToolUse ×2 and Stop ×1. The build adds a 17th: the generated session-env runner, first under SessionStart, with no matcher and a 15 s timeout.[^built-hooks]

**Monitors.** Same three names, byte-identical descriptions, and the same `node "${CLAUDE_PLUGIN_ROOT}/monitors/<file>.mjs"` command.[^config]

**SessionStart context.** `orientation.sh`, `startup-only.sh` and `repos-orientation.sh` produce byte-identical `additionalContext` on Claude.[^fidelity-diff]

**Skills and agents.** 40 of 42 files are byte-identical after token expansion. The other two, `commit-create` (6 lines) and `changeset` (2 lines), read `${CLAUDE_SKILL_DIR}/scripts/…` where the old tree had `${CLAUDE_PLUGIN_ROOT}/skills/<skill>/scripts/…`. Both name the same directory, though `${CLAUDE_SKILL_DIR}`'s expansion in silk's skills has not been watched live.[^fidelity-diff]

## Intended differences

| Area | `plugins/silk` | `plugin/builds/claude` |
| :-- | :-- | :-- |
| Manifest | `$schema` written by hand | no `$schema`; both servers gain `env` with `PLUGINFINITY_HOST`, `PLUGINFINITY_PLUGIN` and `PLUGINFINITY_LIB` |
| Hook command | `bash "${CLAUDE_PLUGIN_ROOT}/hooks/<path>"` | `env PLUGINFINITY_EVENT=<Event> [PLUGINFINITY_FAIL_CLOSED=1] bash <path>` |
| Crash policy | a crash exited non-zero | fail-open via the library's exit trap, except the six fail-closed guards, which deny |
| CLI output (`savvy commit hook …`) | passed straight to the host | re-emitted through `hook_relay`: permission decision, then `decision: block`, then `additionalContext`, then `systemMessage`; non-JSON stdout is logged and answered `{}` |
| Envelope piped to the CLI | raw stdin | `hook_envelope claude` (identity, plus `hook_event_name` when missing) |
| JSON output | pretty-printed | compact, one line |
| `jq` missing | `{}` and an error-log line | silent no-op, logged by the library |
| Logs | `$XDG_STATE_HOME/silk/hook-errors.log`, `SILK_HOOK_DEBUG`, `SILK_HOOK_*_LOG` | `$XDG_STATE_HOME/pluginfinity/silk/{error,debug}.log`, `PLUGINFINITY_DEBUG=1`, lines `<ISO-8601 UTC> [<host>] <component>/<script>: <message>` |
| Session variables | five `SILK_*` exports written by `orientation.sh` to `silk-hook.sh` and `CLAUDE_ENV_FILE` | two declared variables resolved by the generated runner |
| Project dir for the CLI runner | `CLAUDE_PROJECT_DIR`, then the git toplevel | `hook_project_dir`, the call's own tree |
| MCP fallback | always `npx --yes @savvy-web/mcp` | the project's package manager's one-off runner, then `npx --yes` |
| Skill frontmatter | as written | re-serialized where a `targets` block was added (folded `>` scalars become one-line values); same values |
| Helper paths | `hooks/lib/*`, `${CLAUDE_PLUGIN_ROOT}/hooks/lib/…` | `hooks/lib/silk/*`, `$(dirname "$0")/../lib/…` |

The auto-approve reasons of the three auto-approve hooks, and `startup-only.sh`'s context on a malformed payload, match `plugins/silk` again (0.2.1 had dropped both).[^hook-env]

## What it ruled in and out

It ruled in the cutover: the Claude build can replace `plugins/silk` without a behaviour change a user would see, apart from the listed fixes (the `npx` fallback, the session-env pin) and the fail-closed guards. It ruled out a Claude-side regression from adopting the library. The Copilot build is not covered here; see [copilot-plugin-host-gaps](../limitations/copilot-plugin-host-gaps.md).

[^fidelity-diff]: fidelity comparison of plugin/builds/claude against plugins/silk, kept through pluginfinity dogfood rounds 1-3 and folded into this bundle
[^config]: `../../plugin/pluginfinity.config.ts`
[^built-hooks]: `../../plugin/builds/claude/hooks/hooks.json`
[^built-manifest]: `../../plugin/builds/claude/.claude-plugin/plugin.json`
[^hook-env]: `../../plugin/hooks/lib/silk/hook-env.sh`
