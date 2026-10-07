---
type: Module
title: silk-plugin
description: "The silk agent plugin: one pluginfinity source at plugin/ (the private workspace package @savvy-web/ai-plugins) built into a Claude Code plugin and a GitHub Copilot plugin, carrying the skills, agents, hooks, monitors and server launchers for every Silk capability behind the savvy bin and the shared savvy-mcp server."
kind: plugin
resource: ../../plugin
status: draft
tags: [tooling, build]
sources:
  - id: config
    resource: ../../plugin/pluginfinity.config.ts
  - id: manifest
    resource: ../../plugin/package.json
  - id: fidelity
    resource: ../measurements/claude-build-fidelity-against-legacy-plugin.md
  - id: authoring
    resource: ../conventions/plugin-authoring.md
  - id: hook-env
    resource: ../../plugin/hooks/lib/silk/hook-env.sh
  - id: start-mcp
    resource: ../../plugin/bin/start-mcp.sh
  - id: run-tests
    resource: ../../plugin/__test__/run-tests.sh
  - id: changeset-config
    resource: ../../.changeset/config.json
  - id: claude-marketplace
    resource: ../../.claude-plugin/marketplace.json
  - id: hooks
    resource: ../../plugin/hooks
  - id: changesets
    resource: ../../plugin/skills/changeset
  - id: buildtsdoc
    resource: ../../plugin/agents/tsdoctor.md
  - id: turbo
    resource: ../../plugin/skills/turbo
  - id: it2
    resource: ../../plugin/skills/it2
  - id: dogfood
    resource: ../../plugin/skills/dogfood
generated:
  by: okfit/claude-code
  at: 2026-10-07T16:26:44Z
  body_sha256: 4bf7d7ee3d144d21d027d92dc74ac020b4ead47e0c78ed3f4354506db3d910c9
---

# silk-plugin

## Boundary

`plugin/` is the source of truth for the silk agent plugin. It is a private pnpm workspace package, `@savvy-web/ai-plugins`, never published to npm, whose `pluginfinity build` writes two committed builds from one host-neutral source: `plugin/builds/claude/` (Claude Code, `silk@savvy-web-systems`) and `plugin/builds/copilot/` (GitHub Copilot).[^manifest][^config] It is the repo's only plugin. Why one source with two hosts is in [adopt-pluginfinity-one-source-two-hosts](../decisions/adopt-pluginfinity-one-source-two-hosts.md); the editing rule is [edit-plugin-source-not-builds](../conventions/edit-plugin-source-not-builds.md), and the rules for writing hooks, scripts, skills and tests are [plugin-authoring](../conventions/plugin-authoring.md). How faithfully the Claude build reproduces `plugins/silk` is measured in [claude-build-fidelity-against-legacy-plugin](../measurements/claude-build-fidelity-against-legacy-plugin.md).

The organizing split it shares with the MCP server: **information lives in the server, direction lives in the plugin**. The server carries every tool regardless of project; the plugin decides which to surface, when to nudge and what to deny.[^config]

**The legacy copy.** `plugins/silk/` still exists on this branch, and `.claude-plugin/marketplace.json` still points the Claude marketplace at it, because Claude Code review on the pull request reads that path.[^claude-marketplace] It is the pre-pluginfinity plugin awaiting removal; no new work lands there. The release branch deletes `plugins/silk/`, repoints the Claude marketplace entry at `plugin/builds/claude`, and drops the `plugins/*/.claude-plugin/plugin.json` `versionFiles` glob and the `plugins/silk/**` `additionalScopes` entry that still link it to `@savvy-web/silk`.[^changeset-config] Until then the live Claude install still runs `plugins/silk`, including the defects listed under [Hosts](#hosts) that `plugin/` fixes.

## Owner

Source layout under `plugin/`:[^config]

- `pluginfinity.config.ts` — the manifest fields, every hook registration (event, matcher, timeout, `failClosed`), the `savvy-mcp` MCP server and the `biome` LSP server, the three monitors, and the session-env block. This replaces the hand-written `plugin.json`, `hooks.json` and `monitors.json`.
- `skills/`, `agents/` — Markdown with pluginfinity tokens (`{{tool …}}`, `{{skill …}}`, `{{agent …}}`, `{{skill_dir}}`, `{{plugin_root}}`) and host blocks, rendered per host at build time. Per-file `targets` frontmatter carries host-specific fields (`it2` is `copilot: false`).
- `hooks/` — per-event scripts plus `hooks/lib/silk/` (silk's own helpers: package-manager detection and the `savvy` runner, segment splitting, the safe-command allowlists). The hook library itself (`hook_*`) is generated into each build under `lib/pluginfinity/`, not kept in source.
- `bin/` — the `start-mcp.sh` and `biome-lsp.sh` launchers, on pluginfinity's server library.
- `monitors/` — the three node monitor scripts.
- `scripts/env-setup.sh` — the session-env setup script.
- `__test__/` — the bats suites, their fixtures, `run-tests.sh`, and one vitest test (`pr-body-skill-sync.test.ts`).
- `CLAUDE.md` (the agent router for the package) and `README.md` (install and usage for plugin users).

The agents (`changeset-manager`, `turborepo`, `tsdoctor`) each carry a curated tool allowlist that must include `SendMessage` on Claude, since a teammate-dispatched agent without it cannot report back or answer a shutdown request and idle-loops until killed.

**Skill naming.** User-facing skills are tool-prefixed (`changeset`, `changeset-style`, `changeset-config`, `commit-create`) because several tools share one plugin; `pr-body` is the one exception, named for its document since no tool owns a PR description; capability skills are named for their capability (`build`, `tsdoc`, `turbo`, `repos`, `dogfood`, `it2`). Internal mechanics stay unprefixed (`config`, `dependencies`, `update`, `merge`, `delete`, `status`) since only the `changeset-manager` agent calls them by name.[^changesets]

**Server wiring.** The plugin name, the `savvy-mcp` server key and the `biome` LSP key are load-bearing: Claude names the tools `mcp__plugin_silk_savvy-mcp__<tool>`, and the skills, agents and hooks spell them that way.[^config] `bin/start-mcp.sh` execs the project's `node_modules/.bin/savvy-mcp` when present (the bin `@savvy-web/silk` carries), exporting `CLAUDE_PROJECT_DIR` and `SAVVY_MCP_PROJECT_DIR`. Otherwise the server library falls back through the project's own package manager: `pnpm dlx`, `yarn dlx` or `bunx` when that runner is on `PATH`, else `npx --yes @savvy-web/mcp`. Detection reads `devEngines.packageManager`, then `packageManager`, then lockfiles.[^start-mcp] `bin/biome-lsp.sh` launches Biome's language server from the project; neither launcher bundles a binary.

## Build, test and release

**Build.** `plugin/package.json`'s `build:dev` and `build:prod` both run `pluginfinity build` (cache disabled in `plugin/turbo.json`), so `pnpm build` regenerates both builds; `build:check` runs `pluginfinity build --check`, which compares the committed builds byte for byte against a fresh build and fails on any drift.[^manifest] Biome and markdownlint are switched off over `plugin/builds/**` (root `biome.json` override, the markdownlint ignore list and the lint-staged excludes), since a formatter rewriting a built file would fail `--check`. lint-staged's `chmod -x` still covers the builds on purpose: stripping the exec bit from a built copy and its source in the same commit keeps the two modes equal, which `--check` compares.[^manifest]

**Test.** Root `pnpm test:hooks` runs `bash plugin/__test__/run-tests.sh` (the package's own `test:hooks` runs the same script). It runs `pluginfinity build`, shellcheck over the BUILT hook, launcher, skill and `scripts/` files of both targets (the hook library they source exists only in the builds), bats over `__test__/*.bats`, and `build --check`.[^run-tests] Every hook, launcher and skill-script suite runs once per target through pluginfinity's `run_hook`/`run_script`; the monitor suites run on Claude only. The count was 511 tests, none skipped, at the pluginfinity 0.3.0 cut.[^authoring] `.github/workflows/hook-tests.yml` watches `plugin/**` and runs the same script, but the job stays `if: false`; re-enabling it also needs pnpm setup and an install before the step, because the suite runs pluginfinity from `plugin/node_modules`. The old `plugins/silk/tests` suite is no longer wired to any script.

The `pr-body` skill's drift test lives here too: `plugin/__test__/pr-body-skill-sync.test.ts` imports `PrBody` from `@savvy-web/silk-core` (a `workspace:*` devDependency) and fails when a skill's marker literals drift from `PrBody.Markers`. Vitest discovers `plugin/` as a project like any package.[^manifest]

**Release.** `@savvy-web/ai-plugins` versions independently ([ai-plugins-versions-independently](../decisions/ai-plugins-versions-independently.md)), through its own changesets (`privatePackages.version` is on), not in lockstep with `@savvy-web/silk`. Its `.changeset/config.json` entry bumps `plugin/builds/claude/.claude-plugin/plugin.json` and `plugin/builds/copilot/plugin.json` through `versionFiles` beside its own `package.json`, and links `.github/workflows/hook-tests.yml` and `.github/plugin/**` to it through `additionalScopes`; a change under `plugin/` belongs to it as a workspace directory. Never hand-bump any of these manifests. silk's entry still carries the legacy `plugins/silk/**` scope and `plugins/*/.claude-plugin/plugin.json` glob until the release branch removes them.[^changeset-config] Two marketplaces list the plugin: `.claude-plugin/marketplace.json` (Claude Code, still pointed at `plugins/silk` until the release branch) and `.github/plugin/marketplace.json` (Copilot; see [copilot-plugin-marketplace](../interfaces/copilot-plugin-marketplace.md)). `.github/workflows/repin-plugins.yml` advances either one's pinned sha through `spencerbeggs/ai-plugin-marketplace-manager@v2`, choosing the file with its `marketplace: claude-code | copilot` input.

## Hosts

**Claude Code** gets everything: 16 hook registrations plus a generated 17th (the session-env runner, first under SessionStart), the MCP and LSP servers, the three monitors, and every skill and agent. Its SessionStart orientation context is byte-identical to the `plugins/silk` one.[^fidelity]

**GitHub Copilot** gets the hooks, the MCP and LSP servers, every skill except `it2`, and the agents (with `model: inherit` and a whole-`Bash` grant, since Copilot has no per-command rules). It gets no monitors. Its SessionStart `startup` matcher is widened to `startup|new`, because a fresh Copilot session reports `source: new` (see [copilot-plugin-host-environment](../measurements/copilot-plugin-host-environment.md)). The orientation names each host's own MCP prefix, and on Copilot it tells the model to pass `cwd` (the project root's absolute path) to every savvy-mcp tool, because a Copilot MCP server cannot learn the project. That instruction keys on `hook_supports server-project`, which succeeds on Claude and fails on Copilot. What the Copilot build cannot do is the [copilot-plugin-host-gaps](../limitations/copilot-plugin-host-gaps.md) limitation.[^hook-env]

**Copilot build notes.** `pluginfinity validate` passes on both hosts. The Copilot build reports 43 notes, each an accepted degradation:

- agents drop `color` and `maxTurns`, their `skills` list becomes a body list, and `AskUserQuestion`, `SendMessage` and `Skill` leave their tools;
- skills fold `when_to_use`/`paths` into the description, and `model: haiku`/`sonnet` is dropped from five internal skills;
- `hook-output-ignored` for the PreToolUse context of `biome-prefer-mcp.sh` and `dogfood-guard.sh` and the Stop `systemMessage` of `changeset-nudge.sh`;
- `hook-matcher-runtime` and `hook-matcher-widened` for SessionStart;
- `monitor-omitted` ×3 and `env-shell-unsupported`.

A change that adds a note should be one the [copilot-plugin-host-gaps](../limitations/copilot-plugin-host-gaps.md) limitation can absorb.[^config]

**Fixed in `plugin/`, still live in `plugins/silk`:** the `start-mcp.sh` `npx --yes` fallback fails with `EBADDEVENGINES` in a project declaring `devEngines.packageManager`; and the `SILK_PROJECT_DIR` export written into `CLAUDE_ENV_FILE` acts as an explicit override for the skill scripts, pinning `commit.sh` to the session-start tree. The measurement that explains the second is [claude-code-plugin-process-environment](../measurements/claude-code-plugin-process-environment.md).[^fidelity]

## Hook infrastructure and session orientation

Hook registrations live in `pluginfinity.config.ts`; several guards share a matcher (`Bash`, `Write|Edit|NotebookEdit`, the GitKraken/GitHub MCP regex) and a deny from any one entry wins. Every built entry runs its script through `bash` with `PLUGINFINITY_EVENT` set, so the exec bit never matters.[^config] The scripts' plumbing is pluginfinity's hook library: `hook_input`/`hook_require_input` for the payload, `hook_project_dir`/`hook_cd_project` for the tree, `hook_relay` for the `savvy` CLI round trip, `hook_allow`/`hook_deny`/`hook_context`/`hook_system_message` for responses.[^authoring]

**Fail policy.** The library's exit trap fails open by default: a crashing hook answers nothing and the tool call proceeds. The six guard entries (`biome-direct-deny`, `repos-bash-guard`, `repos-mcp-guard`, `repos-fs-guard`, and both `dogfood-guard` entries) carry `failClosed: true`, so a crash in one of them denies the call ("silk hook failed (exit N)"). `__test__/fail-closed-guards.bats` pins that set against the built hooks file.[^config][^authoring]

Three SessionStart hooks split by responsibility: `orientation.sh` (no matcher, fires on every start including resume and compact; emits the always-on `<silk_capabilities>` block and writes no session state); `startup-only.sh` (`matcher: "startup"`, fresh starts only; runs `savvy commit hook session-start` as a side effect and emits the edit-time lint/pre-commit contract); `repos-orientation.sh` (no matcher, self-silencing when `.repos/config.json` does not exist).[^hooks]

**The orientation payload** is deliberately compact and index-shaped because it re-fires on every resume and compact: a one-line-per-tool MCP index, a one-sentence agent index with proactive-dispatch nudges, a skill name list, a short Biome division of labor, a conditional terminal sub-block, and a prose active-hooks note. It names monitors, the it2 skill and the terminal block only where the build ships them (`hook_has`). Depth lives at point-of-use, in the path-triggered skills and the PreToolUse nudges, never duplicated in the always-on payload.[^hooks]

**Session env.** The config's `env` block declares two variables, both defaulting to `""`: `SILK_PACKAGE_MANAGER` (printed by `scripts/env-setup.sh`) and `SILK_SKIP_CHANGESET_NUDGE` (set by the user). A generated SessionStart runner resolves them once per session with precedence default < setup script < project `.env` < `.env.local` < ambient environment, and the library applies the values before every hook body. On Claude the runner also appends them to `CLAUDE_ENV_FILE` so the model's shell sees them; Copilot has no such channel. The empty defaults keep every reader's detect-when-empty fallback live for a reader that races the runner.[^config] This replaces the old `~/.claude/session-env/<id>/silk-hook.sh` file, which reached hooks only because silk sourced it itself. `SILK_PROJECT_DIR` is deliberately NOT declared, because every declared name is appended to `CLAUDE_ENV_FILE`.[^authoring]

**Working-tree resolution (#274).** `hook_project_dir` takes an absolute input `cwd` first, walked up to the nearest `.git` (a worktree's `.git` file counts), else that `cwd` as given; only with no usable `cwd` does Claude fall back to `CLAUDE_PROJECT_DIR`. This is load-bearing because agents routinely work in `.claude/worktrees/agent-*/` on their own branch. Standalone skill scripts with no envelope resolve separately through `hooks/lib/silk/resolve-cli-project-dir.sh`, where the caller's `$PWD` is primary and a user-set `SILK_PROJECT_DIR` is an explicit override.[^authoring]

**Logging.** One standard: `$XDG_STATE_HOME/pluginfinity/silk/error.log`, plus `debug.log` under `PLUGINFINITY_DEBUG=1`, read with `pluginfinity logs --plugin silk`. The old `SILK_HOOK_DEBUG` and `SILK_HOOK_*_LOG` overrides are gone. Skill scripts log refusals through `script_log`.[^authoring]

**Shared conventions across every hook:** guards are tripwires pattern-matching the command string, not the security boundary (which lives elsewhere: OS permissions, CI, tree state); **no bypass flags**, since a guard advertising an env-var escape hatch teaches agents to disarm safety mechanisms, so a wrong deny is corrected at the source instead; every hook, launcher, monitor and skill script has a bats suite under `__test__/`, run by `pnpm test:hooks`.[^run-tests]

## Changeset capability

Pieces: `skills/changeset/` (the router) with `changeset-style` and `changeset-config` beside it, `agents/changeset-manager.md` and its unprefixed internal skills, `hooks/post-tool-use/changeset-validate-changeset.sh`, `hooks/stop/changeset-nudge.sh`. All mutation and inspection goes through `savvy-mcp` changeset tools; only file validation and `--list` shell out.[^changesets]

`/silk:changeset --create|--squash|--list|--preview|--check` is the single user surface: `--create`/`--squash` dispatch to the `changeset-manager` agent; `--check` calls `changeset_validate` directly; `--preview` calls `changeset_preview` directly (the genuine changesets engine, no hand-rolled merge step); `--list` shells out to `@changesets/cli`'s `changeset status --output` for structured JSON, the one skill script targeting a CLI other than `savvy`. A bare or vague invocation defaults to create/reconcile.[^changesets]

`agents/changeset-manager.md`'s tool allowlist carries every changeset MCP grant (`changeset_inspect`, `changeset_validate`, `changeset_preview`, `changeset_deps_regen`, `changeset_deps_detect`) plus `Bash(bash *)` for `list.sh`. Its `config` internal skill (`user-invocable: false`) calls `changeset_inspect` with `mode: "branch"` for create-mode classification, `mode: "config"` for the resolved config view, `mode: "classify"` to resolve one path to its owning package. `dependencies` calls `changeset_deps_detect`/`changeset_deps_regen` directly, both thin adapters over silk-effects' `Changesets.DepsRegen`.[^changesets]

**No hook blocks on changesets.** Whether a change needs a changeset is a human judgement no plugin hook makes: a hook can only see "commits exist, no `.changeset/*.md`", which cannot distinguish a user-facing fix from a docs-only branch. A push-time guard that did block was removed rather than repaired (it resolved its tree from `CLAUDE_PROJECT_DIR`, so its verdict depended on the caller's cwd rather than the ref being pushed, and its deny message advertised an env-var bypass), the origin case for the plugin-wide no-bypass rule. `hooks/stop/changeset-nudge.sh` (Stop) instead emits a `systemMessage` shown to the user, never the model, when the branch has commits and no changeset; it cannot block, fires only for the main agent, and is debounced on HEAD. `SILK_SKIP_CHANGESET_NUDGE` silences it, now also settable from the project's `.env`. Copilot has no `systemMessage`, so the nudge is Claude-only. Enforcement lives at CI on the pull request, where the full branch diff exists and an override is an explicit, reviewable human act.[^changesets]

## Build and TSDoc capability

Pieces: `skills/build/` and `skills/tsdoc/` (each with bundled `references/`), `agents/tsdoctor.md`, `monitors/watch-issues.mjs` (the `tsdoc-diagnostics` monitor). All read the structured `dist/<target>/issues.json` artifact `@savvy-web/tsdown-plugins`' `writeIssuesArtifact` produces.[^buildtsdoc]

`/silk:build` (path-triggered on `savvy.build.ts`, `package.json`, `turbo.json`) is the authoring reference for the bundler/rspress-builder/tsdown-plugins trio. Its load-bearing section distinguishes two failures that produce a clean-looking build log: a hand-run `node savvy.build.ts --target prod` skips `types:check`/`build:dev` and may leave a truncated `issues.json`; a turbo cache hit replays the previous run's output verbatim. The tell is `issues.json`'s `generatedAt` timestamp, not mtime: a turbo cache restore refreshes mtime on every replay while `generatedAt` keeps the original build's value.[^buildtsdoc]

`/silk:tsdoc` (path-triggered on `savvy.build.ts` and `dist/*/issues.json`) teaches toolchain-correct TSDoc and the binary `@public`/`@internal` release-tag policy `runApiExtractor` enforces. It reads the artifact **three-state**: `buildOk: true` with empty buckets is clean; `false` is a crashed build whose empty buckets describe nothing; absent means unknown, not a pass. Every consumer of the artifact repeats this three-state read.[^buildtsdoc]

`agents/tsdoctor.md` drives a package's diagnostics to zero: prod build → read the artifact → fix per the release-tag policy → rebuild to confirm. It never adds `suppressWarnings` entries (suppression is a human escape hatch) and surfaces a genuine `@beta`/`@alpha` maturity call to the user rather than guessing.[^buildtsdoc]

`monitors/watch-issues.mjs` polls `dist/*/issues.json` across packages and surfaces non-zero `ae-*`/`tsdoc-*` counts as notifications. Because the artifact is gitignored, shared and mutable, the monitor reports only what it can **vouch for**: a non-zero count must hold across `STABLE_POLLS` polls before it fires (debounce); `buildOk === true` read three-state; the artifact must be at least as new as `src/**` by mtime (deliberately mtime, not `generatedAt`, since reading `generatedAt` would make every legitimate cache replay look stale); the package's `src/**` and `savvy.build.ts` must be clean; a per-project advisory pid lock (exclusive create, heartbeat-refreshed, age-judged) keeps one resident watcher per project. It deliberately does not recommend dispatching `tsdoctor`: reporting a shared mutable artifact and prescribing a fixer would turn every stray build into dispatched work.[^buildtsdoc] The monitors honour pluginfinity's `PLUGINFINITY_MONITOR_MAX_TICKS` test contract; the registered command never sets it. Stopping one by process name is the [pkill-monitor-kills-every-session](../gotchas/pkill-monitor-kills-every-session.md) trap.[^authoring]

## Turborepo capability

A read-only capability layered over the `savvy-mcp` server's `turbo_inspect` tool (backed by silk-effects' `Turbo` namespace): `skills/turbo/` (skill plus `references/`), `agents/turborepo.md`, one entry in `hooks/lib/silk/safe-bash-patterns.txt`.[^turbo] `turbo_inspect` has no hook; it is a read-only tool the agent calls directly. The `turborepo` agent's contract is diagnose first, recommend second: it pulls actual hash contributors and graph edges via `turbo_inspect` and edits `turbo.json` only once it can cite the contributor that justifies the change.[^turbo] `safe-bash-patterns.txt` auto-allows `turbo … --dry`/`--dry=json` through the commit guard's hot path; the bare `turbo run <task>` form, which executes the task and mutates the cache, is intentionally not allowlisted, which keeps the capability read-only at the Bash layer as well as the tool layer.[^turbo]

## it2 pane-orchestration capability

Claude-only (`targets: { copilot: false }`), and the lightest capability, with no agent, MCP tool, hook or guard: `skills/it2/SKILL.md` plus the `<terminal>` sub-block in `hooks/session-start/orientation.sh`.[^it2] The gated orientation block renders only when `TERM_PROGRAM == "iTerm.app"` or `LC_TERMINAL == "iTerm2"`, AND `it2` is on `PATH`: a deliberately prompt-free, env-only gate, since the hook fires on every resume/compact and any it2 call risks the first-use API-authorization dialog or a hang.[^it2] `/silk:it2` (description-triggered, no `paths` trigger since it has no backing file) is the self-contained playbook: split-direction semantics, a geometry-driven layout heuristic, grid recipes, session-id-prefix badging, and dismiss-and-close discipline. Every it2 call and geometry query happens at point-of-use, never in a hook.[^it2] The [dogfood capability](#dogfood-mailbox-protocol) uses it2 as a cross-session doorbell/spawn transport; this capability uses it as a pane-layout tool for subagents: same CLI, different job. Both decline it2's auto-approve/modal plugins, since cross-session auto-approval is permission laundering.[^it2]

## Dogfood-mailbox protocol

A repeatable loop for two agent sessions in sibling repo checkouts to request, deliver, adopt and iterate on cross-repo changes before anything is released. Pieces: `skills/dogfood/` (skill, two `references/`, `scripts/journal-append.sh`, `scripts/override-audit.mjs`), `hooks/pre-tool-use/dogfood-guard.sh`, `monitors/dogfood-mail.mjs` (Claude only). State lives on disk under the gitignored `.claude/dogfood/` in each repo.[^dogfood]

State is a per-loop **append-only JSONL journal**, `.claude/dogfood/<counterpart-id>[.<loop-id>].jsonl`, never edited in place: current state is the last valid line, history is the file, corrections are appends, and a corrupt tail self-heals because every reader walks back to the last parseable line. Mail lands in the receiving repo at `.claude/dogfood/<sender-id>/`, one mailbox per counterpart (not per loop); a mail file may carry a `loop:` frontmatter key routing it to the matching journal, omitting it is the single-loop default. Mailbox and journal are gitignored on both sides.[^dogfood]

**The push guard** (`hooks/pre-tool-use/dogfood-guard.sh`, registered on both `Bash` and the GitKraken/GitHub MCP matcher, fail-closed on both) scans only the `overrides:` block of `pnpm-workspace.yaml` for a `file:`/`link:` path escaping the repo, and denies on any branch except `dev` (a long-lived integration branch exempt unconditionally). It has no bypass flag: a wrong deny is corrected by appending a `correction` snapshot, because a linked `file:` override is a mechanical fact readable from the tree, never a judgement call.[^dogfood]

**The rules worth knowing before editing this protocol:** mailbox content is never design documentation (the `okf/` bundle is the durable record; a learning worth keeping is promoted there as a concept, written via the `okfit:okf-docs` agent, in a docs pass); claims about an artifact are verified by a stated method (signatures read from the built `.d.ts`, presence checked with a recursive search citing a module path); a multi-package cut is released per package, so `--watch`/`--exit` probe `npm view` once per package; the safety net and the check are never present at the same time, since while linked the `file:` override replaces semver resolution outright and `--exit`'s registry install runs with no net; the opening ball is a fact about the opening mail, not about role; a relay owes its downstream a `status`; a closed loop reopens through `briefing`; it2 is an optional transport, never authoritative, and the file mailbox is the source of truth. The it2 doorbell currently over-delivers: [it2-doorbell-retry-duplicates](../gotchas/it2-doorbell-retry-duplicates.md).[^dogfood]

**The repo-level convention this protocol generalizes** is [effected-dogfood-rounds](../conventions/effected-dogfood-rounds.md): a round consumes a sibling checkout's LOCAL prod artifacts via `pnpm-workspace.yaml` `overrides:` entries, the branch does not push while they are linked, and the exit is a live release, deleted overrides, a clean registry install and full verification before the finalize workflow. The pluginfinity rounds of 2026-10-06/07 ran this loop against `pluginfinity-workspace` and ended in the pluginfinity 0.3.0 release; their mail is history under `.claude/dogfood/pluginfinity-workspace/`, and this concept and the ones it links are where the durable results were promoted.[^dogfood]

[^config]: `../../plugin/pluginfinity.config.ts`
[^manifest]: `../../plugin/package.json`
[^fidelity]: `../measurements/claude-build-fidelity-against-legacy-plugin.md`
[^authoring]: `../conventions/plugin-authoring.md`
[^hook-env]: `../../plugin/hooks/lib/silk/hook-env.sh`
[^start-mcp]: `../../plugin/bin/start-mcp.sh`
[^run-tests]: `../../plugin/__test__/run-tests.sh`
[^changeset-config]: `../../.changeset/config.json`
[^claude-marketplace]: `../../.claude-plugin/marketplace.json`
[^hooks]: `../../plugin/hooks`
[^changesets]: `../../plugin/skills/changeset`
[^buildtsdoc]: `../../plugin/agents/tsdoctor.md`
[^turbo]: `../../plugin/skills/turbo`
[^it2]: `../../plugin/skills/it2`
[^dogfood]: `../../plugin/skills/dogfood`
