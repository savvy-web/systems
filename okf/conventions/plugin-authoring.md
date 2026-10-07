---
type: Convention
title: Author silk plugin hooks, scripts, skills and tests on the pluginfinity libraries
description: "Write plugin/ hooks on pluginfinity's hook library (input, project dir, relay, responses, logging), mark guards failClosed, declare session variables in the config instead of exporting them, spell host-specific text with tokens and host blocks, and test every hook and script once per target through run_hook/run_script."
status: draft
tags: [tooling, testing]
stale_after: 2027-04-05T00:00:00Z
sources:
  - id: config
    resource: ../../plugin/pluginfinity.config.ts
  - id: hook-env
    resource: ../../plugin/hooks/lib/silk/hook-env.sh
  - id: resolver
    resource: ../../plugin/hooks/lib/silk/resolve-cli-project-dir.sh
  - id: env-setup
    resource: ../../plugin/scripts/env-setup.sh
  - id: common
    resource: ../../plugin/__test__/common.bash
  - id: fail-closed
    resource: ../../plugin/__test__/fail-closed-guards.bats
  - id: run-tests
    resource: ../../plugin/__test__/run-tests.sh
generated:
  by: okfit/claude-code
  at: 2026-10-07T16:26:44Z
  body_sha256: a181d0e45723ce561739feaa9162b6a4f4f25f8478d4ac7cde0b2e3ad2dcb4e2
---

# Author silk plugin hooks, scripts, skills and tests on the pluginfinity libraries

These rules apply to everything under `plugin/`. Where to make a change, and committing the rebuilt builds, is [edit-plugin-source-not-builds](edit-plugin-source-not-builds.md). The layout is in [silk-plugin](../modules/silk-plugin.md).

## Hooks

- **Register every hook in `pluginfinity.config.ts`**, with its event, matcher, timeout and script. There is no hand-written `hooks.json`. Every built entry runs the script through `bash` with `PLUGINFINITY_EVENT` set (`scripts.invoke: "bash"`), so never rely on the exec bit or a shebang.[^config]
- **Use the library for all plumbing**, never hand-rolled helpers. Read the payload with `hook_input`, reject a malformed one with `hook_require_input`, and resolve the tree with `hook_project_dir`/`hook_cd_project`. Call the `savvy` CLI through `hook_envelope claude` piped into the CLI and `hook_relay` on its output. Respond with `hook_noop`/`hook_allow "<reason>"`/`hook_deny`/`hook_context`/`hook_system_message`, and log with `hook_log`/`hook_debug`. Find the plugin root with `hook_plugin_root`, never `CLAUDE_PLUGIN_ROOT`.[^hook-env]
- **Keep silk-only helpers in `hooks/lib/silk/`** (package-manager detection and the `savvy` runner, segment splitting, the safe-command lists). The library under `hooks/lib/pluginfinity/` and `lib/pluginfinity/` exists only in the builds.[^hook-env]
- **Mark a guard `failClosed: true`.** The library's exit trap fails open, so a crashing hook answers nothing and the call proceeds. That is right for advisory hooks (`commit-*`, `biome-prefer-mcp`, PostToolUse, SessionStart, Stop) and wrong for a guard. The six guards are `biome-direct-deny`, `repos-bash-guard`, `repos-mcp-guard`, `repos-fs-guard` and both `dogfood-guard` entries. A new guard joins that list and `fail-closed-guards.bats`.[^config][^fail-closed]
- **Resolve the project from the call, not the session.** `hook_project_dir` takes an absolute input `cwd` walked up to the nearest `.git` (a worktree's `.git` file counts), else that `cwd` as given; with no usable `cwd`, Claude answers `CLAUDE_PROJECT_DIR`, then `$PWD` walked up, and Copilot answers `$PWD` unwalked. A relative `cwd` is ignored. It never returns empty, so write no "nothing resolves" branch. This is the #274 worktree contract: an env var must never outrank the call's own `cwd`.[^hook-env]
- **Ask the library about the host; don't branch on it.** Use `hook_supports <capability>` (response kinds, `env-shell`, `server-project`), `hook_has <monitor|skill|agent|server> <name>` for shipped components, and `hook_tool_prefix savvy-mcp` for the MCP prefix. The plugin has no `hook_host` branch: even the Copilot-only `cwd` note goes through `silk_mcp_needs_cwd`, which asks `hook_supports server-project`. Keep it that way.[^hook-env]
- **Logs go to one place:** `$XDG_STATE_HOME/pluginfinity/silk/error.log`, plus `debug.log` under `PLUGINFINITY_DEBUG=1`, read with `pluginfinity logs --plugin silk` (`--human` under an agent). Add no `SILK_*_LOG` override.

## Session variables

- **Declare a session variable in the config's `env` block; never export it from a hook.** The generated runner resolves each declared name once per SessionStart, with precedence default < `scripts/env-setup.sh` < project `.env` < `.env.local` < ambient environment. The library applies the values before every hook body, and on Claude the runner appends them to `CLAUDE_ENV_FILE`.[^config]
- **Give every variable an empty default and keep the reader's detect-when-empty fallback.** A reader that races the runner, a Copilot event with no `cwd`, or a deleted worktree all see `""`.[^config]
- **Never declare `SILK_PROJECT_DIR`.** Every declared name lands in `CLAUDE_ENV_FILE` and so becomes ambient in skill scripts. `resolve-cli-project-dir.sh` treats a set `SILK_PROJECT_DIR` as a deliberate override, so declaring it pins the skill scripts to the session-start tree. It stays a user-set override only. `SILK_REPOS_SYNC_TIMEOUT` stays ambient-only too.[^resolver]
- **`env-setup.sh` prints only `NAME=value` lines** and runs with no hook library, from the project, under a 10 s bound.[^env-setup]
- Per-session debounce markers (`changeset-nudge.sh`, `biome-prefer-mcp.sh`) live under `~/.claude/session-env/<id>/`. They are markers, not env.

## Skill scripts, launchers and monitors

- **A skill script finds itself from `$0`, never `CLAUDE_PLUGIN_ROOT`** (neither host sets it for a script the model runs), and finds the project from the caller's `$PWD` through `resolve-cli-project-dir.sh`. Build any library path from an absolute script directory before the first `cd`.[^resolver]
- **Log a refusal or failure with `script_log`** (source `lib/pluginfinity/log.sh`, a no-op when absent) and a success path with `script_debug`. Messages to the caller still go to stderr.
- **Launchers use the server library.** `start-mcp.sh` ends in `server_exec_bin savvy-mcp @savvy-web/mcp --install @savvy-web/silk`. Never add a bare `npx --yes` fallback: npm refuses it with `EBADDEVENGINES` in a project declaring `devEngines.packageManager`.
- **Monitors honour `PLUGINFINITY_MONITOR_MAX_TICKS=<n>`**: stop after `n` checks, however each was triggered. Ignore a value that is not a positive integer. Only tests set it.

## Skills and agents

- **Spell host-specific names with tokens:** `{{tool …}}`, `{{skill …}}`, `{{agent …}}`, `{{plugin_root}}`, and `{{skill_dir}}`/`{{skill_dir <skill>}}` for a skill's scripts. Write a Claude-only tool name (`AskUserQuestion`, `SendMessage`) as a backtick-aware fallback token, ``{{tool `AskUserQuestion` | <Copilot wording>}}``. An agent has no skill directory, so a named `{{skill_dir}}` in an agent fails the Copilot build; use host blocks there.
- **Use a host block only where a token cannot fit the sentence.** Inside a list, indent the marker to the item's content column: [markdownlint-fix-renumbers-host-block-lists](../gotchas/markdownlint-fix-renumbers-host-block-lists.md).
- **Put host-only frontmatter under `targets`.** On Copilot: `model: inherit` for agents, a whole-`Bash` grant (no per-command rules exist there), and a shorter `description` where the folded form runs past about 1,000 characters. Exclude a skill from a host with `targets: { copilot: false }`, as `it2` is.

## Tests

- **Test every hook, launcher and skill script once per target** through `__test__/common.bash` (`silk_run` over `run_hook`, `silk_script` over `run_script`), so each runs with the built entry's environment, including `PLUGINFINITY_EVENT` and the fail policy. Monitor suites run on Claude only, through `run_monitor --cwd <project>` with its wall-clock `--timeout`.[^common]
- **Build git-backed fixtures** (`make_repo_project`, real `git worktree add` trees), since a real silk project is a repository. Keep the non-git-cwd cases explicit.[^common]
- **Pass no project variable to a skill-script test** unless the case is about a caller-set `CLAUDE_PROJECT_DIR`. A script run through the Bash tool gets none (see [claude-code-plugin-process-environment](../measurements/claude-code-plugin-process-environment.md)).[^common]
- **Stub every package-manager runner** (`pnpm`, `yarn`, `bun`, `bunx`) in launcher tests. The server fallback dispatches through them, and an unstubbed lockfile test reaches the real package manager and starts the real savvy-mcp.
- **Run the suite with `pnpm test:hooks`**: build, shellcheck the built scripts of both targets, bats, then `build --check`. Lint the BUILT scripts, never the source: the library they source exists only in the builds.[^run-tests]

[^config]: `../../plugin/pluginfinity.config.ts`
[^hook-env]: `../../plugin/hooks/lib/silk/hook-env.sh`
[^resolver]: `../../plugin/hooks/lib/silk/resolve-cli-project-dir.sh`
[^env-setup]: `../../plugin/scripts/env-setup.sh`
[^common]: `../../plugin/__test__/common.bash`
[^fail-closed]: `../../plugin/__test__/fail-closed-guards.bats`
[^run-tests]: `../../plugin/__test__/run-tests.sh`
