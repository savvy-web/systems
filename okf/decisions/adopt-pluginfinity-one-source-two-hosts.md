---
type: Decision
title: Build the silk plugin from one pluginfinity source for two hosts
description: "The silk plugin's source of truth moves from the hand-maintained Claude Code tree at plugins/silk to a pluginfinity source at plugin/, which builds a Claude Code plugin and a GitHub Copilot plugin and owns the hook, server, monitor, log and session-env plumbing silk used to hand-roll."
status: stable
tags: [tooling, architecture, build]
sources:
  - id: config
    resource: ../../plugin/pluginfinity.config.ts
  - id: migration
    resource: ../measurements/claude-build-fidelity-against-legacy-plugin.md
  - id: run-tests
    resource: ../../plugin/__test__/run-tests.sh
  - id: dogfood-release
    resource: "npm:pluginfinity@0.3.0"
    title: pluginfinity 0.3.0, the release that closed the 2026-10-06/07 dogfood rounds
generated:
  by: okfit/claude-code
  at: 2026-10-07T16:26:44Z
  body_sha256: 6e63e0d8ec82d2b0370eb0c4322af0746aa78b703a55cbb0a8c8c8da941c106d
verified:
  - by: human:spencer
    at: 2026-10-07T16:15:02Z
  - by: human:spencer
    at: 2026-10-07T16:22:37Z
---

# Build the silk plugin from one pluginfinity source for two hosts

## Context

`plugins/silk` was a hand-written Claude Code plugin: a `plugin.json`, a `hooks.json`, a `monitors.json`, and a `hooks/lib/` of helpers vendored from plugin-bot (`hook-output.sh`, `hook-debug.sh`, `run-cli.sh`, a session-env sourcing shim). It could only ever target Claude Code. Several of its hand-rolled pieces were also wrong in ways a live measurement exposed: the `npx --yes` MCP fallback, the `SILK_PROJECT_DIR` export, and a session-env file that reached hooks only because silk sourced it itself ([claude-code-plugin-process-environment](../measurements/claude-code-plugin-process-environment.md)).[^migration]

## Decision

Make `plugin/`, a private workspace package, the plugin's only source, and generate both hosts from it with `pluginfinity` (`^0.3.0`, from npm):[^config]

- **One config, two builds.** `pluginfinity.config.ts` declares the manifest, the hooks, the MCP and LSP servers, the monitors and the session env; `pluginfinity build` writes `plugin/builds/claude/` and `plugin/builds/copilot/`, both committed. Skills and agents carry host tokens and host blocks instead of being forked per host.
- **Plumbing belongs to the library.** Input parsing, project-dir resolution (input `cwd` first, the #274 worktree contract), the CLI relay, responses, logging (`$XDG_STATE_HOME/pluginfinity/silk/`), the fail policy (`failClosed: true` on the six guards) and the session env (a declared `env` block plus `scripts/env-setup.sh`) come from pluginfinity's hook, server, monitor, log and env libraries. silk keeps only its own logic and helpers (`hooks/lib/silk/`).
- **Behaviour is preserved, then measured.** The Claude build was held to `plugins/silk` with a written fidelity diff (`measurements/claude-build-fidelity-against-legacy-plugin.md`): same 16 hook registrations, byte-identical SessionStart orientation context, 40 of 42 skill and agent files byte-identical after token expansion. Every difference is either intended or listed as a gap.[^migration]
- **The suite runs against both builds.** `plugin/__test__/run-tests.sh` builds, shellchecks the built scripts of both targets, runs bats once per target, and runs `build --check`.[^run-tests]
- **The library was shaped against this plugin before release.** Three dogfood rounds on 2026-10-06/07 linked pluginfinity's local prod builds into this repo, fed silk's needs back upstream (fail policy, session env, `{{skill_dir}}`, `hook_supports server-project`, monitor tick contract), and ended in the 0.3.0 release this package depends on.[^dogfood-release]

The cutover is staged. This branch adds `plugin/` beside `plugins/silk/` and leaves the Claude marketplace on `plugins/silk`, because Claude Code review on the pull request reads that path; the release branch deletes `plugins/silk/` and repoints the Claude marketplace at `plugin/builds/claude`.

## Alternatives rejected

- **Keep hand-maintaining `plugins/silk` and add a second, hand-written Copilot tree.** Rejected: two trees drift, and every hook would carry its own host branches. The Copilot build has exactly one host branch, isolated in `silk_mcp_needs_cwd`, which asks the library's `hook_supports server-project`.[^migration]
- **Generate the builds at install or release time instead of committing them.** Rejected: a marketplace installs a plugin from a git path at a pinned sha, so the built tree must exist in the repository. `build --check` keeps the committed builds honest instead.
- **Keep silk's own hook library beside pluginfinity's.** Rejected: the hand-rolled session-env file and logging overrides were the source of the defects above, and the library now covers each of them with a tested contract.

## Consequences

- Edit `plugin/`, never `plugin/builds/`, and commit the rebuilt builds with the source change: [edit-plugin-source-not-builds](../conventions/edit-plugin-source-not-builds.md).
- The plugin gains a Copilot install through [copilot-plugin-marketplace](../interfaces/copilot-plugin-marketplace.md), with the gaps in [copilot-plugin-host-gaps](../limitations/copilot-plugin-host-gaps.md).
- `SILK_HOOK_DEBUG`, `SILK_HOOK_*_LOG`, and the `SILK_PROJECT_DIR`/`SILK_DATA_DIR`/`SILK_PLUGIN_ROOT`/`SILK_SESSION_ID` session exports are gone; `SILK_PACKAGE_MANAGER` and `SILK_SKIP_CHANGESET_NUDGE` are the only declared session variables.
- Until the release branch lands, `plugins/silk/` is a legacy copy that still serves the Claude marketplace and still carries the defects `plugin/` fixes.
- See [silk-plugin](../modules/silk-plugin.md) for the resulting layout.

[^config]: `../../plugin/pluginfinity.config.ts`
[^migration]: `../measurements/claude-build-fidelity-against-legacy-plugin.md`
[^run-tests]: `../../plugin/__test__/run-tests.sh`
[^dogfood-release]: `npm:pluginfinity@0.3.0`
