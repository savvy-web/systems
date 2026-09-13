---
type: Module
title: silk-plugin
description: The silk@savvy-web-systems Claude Code plugin — skills, agents, hooks and background monitors for every Silk capability behind the savvy bin and the shared savvy-mcp server.
kind: plugin
resource: ../../plugins/silk
status: draft
tags: [tooling]
sources:
  - id: plugin
    resource: ../../plugins/silk/.claude-plugin/plugin.json
  - id: hooks
    resource: ../../plugins/silk/hooks
  - id: changesets
    resource: ../../plugins/silk/skills/changeset
  - id: buildtsdoc
    resource: ../../plugins/silk/agents/tsdoctor.md
  - id: turbo
    resource: ../../plugins/silk/skills/turbo
  - id: it2
    resource: ../../plugins/silk/skills/it2
  - id: dogfood
    resource: ../../plugins/silk/skills/dogfood
generated:
  by: okfit/claude-code
  at: 2026-09-13T01:18:00Z
  body_sha256: d8f018199a9a41b72c37f6f607cba792e38d18b944a0928c1e7082d58c3ae8fb
---

# silk-plugin

## Boundary

`plugins/silk` is the `silk@savvy-web-systems` Claude Code plugin, authored and bundled in this monorepo (plugins are static, not runtime-discovered) and registered in `.claude-plugin/marketplace.json`. It is the repo's only plugin, version-bumped in lockstep with `@savvy-web/silk` via that package's `versionFiles` glob.[^plugin] The organizing split it shares with the MCP server: **information lives in the server, direction lives in the plugin** — the server carries every tool regardless of project, the plugin decides which to surface, when to nudge and what to deny.[^plugin]

## Owner

Layout: `.claude-plugin/plugin.json` (manifest plus `mcpServers`/`lspServers`), `skills/` (every `/silk:*` skill), `agents/` (`changeset-manager`, `turborepo`, `tsdoctor` — each with a curated `tools:` allowlist that must include `SendMessage`, since a teammate-dispatched agent without it cannot report back or answer a shutdown request and idle-loops until killed), `hooks/` (`hooks.json` plus per-event script dirs and shared `lib/`), `monitors/` (`monitors.json` plus background monitor scripts), `bin/` (launchers for the MCP server and Biome LSP), `tests/` (the bats + shellcheck harness run by `pnpm test:hooks`).[^plugin]

**Skill naming.** User-facing skills are tool-prefixed (`changeset`, `changeset-style`, `changeset-config`, `commit-create`) because several tools share one plugin; `pr-body` is the one exception, named for its document since no tool owns a PR description; capability skills are named for their capability (`build`, `tsdoc`, `turbo`, `repos`, `dogfood`, `it2`). Internal mechanics stay unprefixed (`config`, `dependencies`, `update`, `merge`, `delete`, `status`) since only the `changeset-manager` agent calls them by name.[^plugin]

**Server wiring.** The `mcpServers` block spawns the shared `savvy-mcp` server (`@savvy-web/mcp`, tools-only) via `sh ${CLAUDE_PLUGIN_ROOT}/bin/start-mcp.sh`, which `exec`s `$ROOT/node_modules/.bin/savvy-mcp` when it is executable (the bin `@savvy-web/silk` carries) and otherwise falls back to `npx --yes @savvy-web/mcp "$@"`, printing a package-manager-specific install hint to stderr first. Detection never uses a package-manager dispatch (`pnpm exec`/`bunx`) as the exec target — that resolved the bin through the manager's workspace rules rather than the project's installed tree.[^plugin] The `lspServers.biome` block launches Biome's language server via `sh bin/biome-lsp.sh`; neither launcher bundles a binary, both expect the tool on `PATH` or resolvable from the project.[^plugin]

## Hook infrastructure and session orientation

`hooks/hooks.json` is the single registry; several guards share a matcher (`Bash`, `Write|Edit|NotebookEdit`, the GitKraken/GitHub MCP regex) and a deny from any one entry wins. Every hook reads its JSON envelope from stdin, fails open on missing `jq` or a malformed envelope, and always exits 0 — the emitted JSON is the decision signal.[^hooks]

Three SessionStart hooks split by responsibility: `orientation.sh` (no matcher, fires on every start including resume and compact — the env **producer** and the emitter of the always-on `<silk_capabilities>` block); `startup-only.sh` (`matcher: "startup"`, fresh starts only — runs `savvy commit hook session-start` as a side effect and emits the edit-time lint/pre-commit contract); `repos-orientation.sh` (no matcher, self-silencing when `.repos/config.json` does not exist).[^hooks]

**The orientation payload** is deliberately compact and index-shaped because it re-fires on every resume and compact: a one-line-per-tool MCP index, a one-sentence agent index with proactive-dispatch nudges, a skill name list, a short Biome division of labor, a conditional terminal sub-block, and a prose active-hooks note. Depth lives at point-of-use — the path-triggered skills and PreToolUse nudges — never duplicated in the always-on payload.[^hooks]

**Session env namespace.** Claude Code auto-sources `$CLAUDE_ENV_FILE` into Bash-tool subprocesses but NOT into hook subprocesses, so the producer writes `SILK_*` vars (project dir, data dir, plugin root, session id, package manager) both to `$CLAUDE_ENV_FILE` and to a per-session `silk-hook.sh` under `~/.claude/session-env/<session_id>/`; reader hooks source every `*hook*.sh` in that dir so multiple plugins coexist. `SILK_PROJECT_DIR` names the session's primary checkout — it is NOT a per-call project-dir override.[^hooks]

**Working-tree resolution.** `hooks/lib/hook-env.sh`'s `resolve_project_dir` takes the envelope's `cwd` first, then `SILK_PROJECT_DIR`, then `CLAUDE_PROJECT_DIR` — load-bearing because agents routinely work in `.claude/worktrees/agent-*/` on their own branch, and ranking an env var above `cwd` would resolve git state from a tree unrelated to the call being handled. Standalone skill scripts with no envelope resolve separately via `hooks/lib/resolve-cli-project-dir.sh`, where the caller's `$PWD` is primary and `SILK_PROJECT_DIR` is an explicit override.[^hooks]

**Shared conventions across every hook:** a canonical `lib/` with no per-plugin duplicates (`hook-output.sh`, `hook-debug.sh`, `hook-env.sh`, plus `run-cli.sh` for CLI-calling hooks); hook scripts commit as `100644` with no exec bit, since `hooks.json` and the bats runner invoke every hook as `bash "${CLAUDE_PLUGIN_ROOT}/hooks/..."`; guards are tripwires pattern-matching the command string, not the security boundary (which lives elsewhere — OS permissions, CI, tree state); **no bypass flags**, since a guard advertising an env-var escape hatch teaches agents to disarm safety mechanisms — a wrong deny is corrected at the source instead; every hook, monitor and skill script has a bats suite under `tests/`, run by `pnpm test:hooks`.[^hooks]

## Changeset capability

Pieces: `skills/changeset/` (the router) with `changeset-style` and `changeset-config` beside it, `agents/changeset-manager.md` and its unprefixed internal skills, `hooks/post-tool-use/changeset-validate-changeset.sh`, `hooks/stop/changeset-nudge.sh`. All mutation and inspection goes through `savvy-mcp` changeset tools; only file validation and `--list` shell out.[^changesets]

`/silk:changeset --create|--squash|--list|--preview|--check` is the single user surface: `--create`/`--squash` dispatch to the `changeset-manager` agent; `--check` calls `changeset_validate` directly; `--preview` calls `changeset_preview` directly (the genuine changesets engine, no hand-rolled merge step); `--list` shells out to `@changesets/cli`'s `changeset status --output` for structured JSON — the one skill script targeting a CLI other than `savvy`. A bare or vague invocation defaults to create/reconcile.[^changesets]

`agents/changeset-manager.md`'s `tools:` allowlist carries every changeset MCP grant (`changeset_inspect`, `changeset_validate`, `changeset_preview`, `changeset_deps_regen`, `changeset_deps_detect`) plus `Bash(bash *)` for `list.sh`. Its `config` internal skill (`user-invocable: false`) calls `changeset_inspect` with `mode: "branch"` for create-mode classification, `mode: "config"` for the resolved config view, `mode: "classify"` to resolve one path to its owning package. `dependencies` calls `changeset_deps_detect`/`changeset_deps_regen` directly, both thin adapters over silk-effects' `Changesets.DepsRegen`.[^changesets]

**No hook blocks on changesets.** Whether a change needs a changeset is a human judgement no plugin hook makes — a hook can only see "commits exist, no `.changeset/*.md`", which cannot distinguish a user-facing fix from a docs-only branch. A push-time guard that did block was removed rather than repaired (it resolved its tree from `CLAUDE_PROJECT_DIR`, so its verdict depended on the caller's cwd rather than the ref being pushed, and its deny message advertised an env-var bypass) — the origin case for the plugin-wide no-bypass rule. `hooks/stop/changeset-nudge.sh` (Stop) instead emits a `systemMessage` shown to the user, never the model, when the branch has commits and no changeset; it cannot block, fires only for the main agent, and is debounced on HEAD. `SILK_SKIP_CHANGESET_NUDGE` silences it. Enforcement lives at CI on the pull request, where the full branch diff exists and an override is an explicit, reviewable human act.[^changesets]

## Build and TSDoc capability

Pieces: `skills/build/` and `skills/tsdoc/` (each with bundled `references/`), `agents/tsdoctor.md`, `monitors/watch-issues.mjs`. All read the structured `dist/<target>/issues.json` artifact `@savvy-web/tsdown-plugins`' `writeIssuesArtifact` produces.[^buildtsdoc]

`/silk:build` (path-triggered on `savvy.build.ts`, `package.json`, `turbo.json`) is the authoring reference for the bundler/rspress-builder/tsdown-plugins trio. Its load-bearing section distinguishes two failures that produce a clean-looking build log: a hand-run `node savvy.build.ts --target prod` skips `types:check`/`build:dev` and may leave a truncated `issues.json`; a turbo cache hit replays the previous run's output verbatim. The tell is `issues.json`'s `generatedAt` timestamp, not mtime — a turbo cache restore refreshes mtime on every replay while `generatedAt` keeps the original build's value.[^buildtsdoc]

`/silk:tsdoc` (path-triggered on `savvy.build.ts` and `dist/*/issues.json`) teaches toolchain-correct TSDoc and the binary `@public`/`@internal` release-tag policy `runApiExtractor` enforces. It reads the artifact **three-state**: `buildOk: true` with empty buckets is clean; `false` is a crashed build whose empty buckets describe nothing; absent means unknown, not a pass. Every consumer of the artifact repeats this three-state read.[^buildtsdoc]

`agents/tsdoctor.md` drives a package's diagnostics to zero: prod build → read the artifact → fix per the release-tag policy → rebuild to confirm. It never adds `suppressWarnings` entries (suppression is a human escape hatch) and surfaces a genuine `@beta`/`@alpha` maturity call to the user rather than guessing.[^buildtsdoc]

`monitors/watch-issues.mjs` polls `dist/*/issues.json` across packages and surfaces non-zero `ae-*`/`tsdoc-*` counts as notifications. Because the artifact is gitignored, shared and mutable, the monitor reports only what it can **vouch for**: a non-zero count must hold across `STABLE_POLLS` polls before it fires (debounce); `buildOk === true` read three-state; the artifact must be at least as new as `src/**` by mtime (deliberately mtime, not `generatedAt` — reading `generatedAt` would make every legitimate cache replay look stale); the package's `src/**` and `savvy.build.ts` must be clean; a per-project advisory pid lock (exclusive create, heartbeat-refreshed, age-judged) keeps one resident watcher per project. It deliberately does not recommend dispatching `tsdoctor` — reporting a shared mutable artifact and prescribing a fixer would turn every stray build into dispatched work.[^buildtsdoc]

## Turborepo capability

A read-only capability layered over the `savvy-mcp` server's `turbo_inspect` tool (backed by silk-effects' `Turbo` namespace): `skills/turbo/` (skill plus `references/`), `agents/turborepo.md`, one entry in `hooks/lib/safe-bash-patterns.txt`.[^turbo] `turbo_inspect` has no hook — it is a read-only tool the agent calls directly. The `turborepo` agent's contract is diagnose first, recommend second: it pulls actual hash contributors and graph edges via `turbo_inspect` and edits `turbo.json` only once it can cite the contributor that justifies the change.[^turbo] `hooks/lib/safe-bash-patterns.txt` auto-allows `turbo … --dry`/`--dry=json` through the commit guard's hot path; the bare `turbo run <task>` form, which executes the task and mutates the cache, is intentionally not allowlisted — the line that keeps the capability read-only at the Bash layer as well as the tool layer.[^turbo]

## it2 pane-orchestration capability

The lightest capability, with no agent, MCP tool, hook or guard: `skills/it2/SKILL.md` plus the `<terminal>` sub-block in `hooks/session-start/orientation.sh`.[^it2] The gated orientation block renders only when `TERM_PROGRAM == "iTerm.app"` or `LC_TERMINAL == "iTerm2"`, AND `it2` is on `PATH` — a deliberately prompt-free, env-only gate, since the hook fires on every resume/compact and any it2 call risks the first-use API-authorization dialog or a hang.[^it2] `/silk:it2` (description-triggered, no `paths` trigger since it has no backing file) is the self-contained playbook: split-direction semantics, a geometry-driven layout heuristic, grid recipes, session-id-prefix badging, and dismiss-and-close discipline. Every it2 call and geometry query happens at point-of-use, never in a hook.[^it2] The [dogfood capability](#dogfood-mailbox-protocol) uses it2 as a cross-session doorbell/spawn transport; this capability uses it as a pane-layout tool for subagents — same CLI, different job. Both decline it2's auto-approve/modal plugins, since cross-session auto-approval is permission laundering.[^it2]

## Dogfood-mailbox protocol

A repeatable loop for two agent sessions in sibling repo checkouts to request, deliver, adopt and iterate on cross-repo changes before anything is released. Pieces: `skills/dogfood/` (skill, two `references/`, `scripts/journal-append.sh`, `scripts/override-audit.mjs`), `hooks/pre-tool-use/dogfood-guard.sh`, `monitors/dogfood-mail.mjs`. State lives on disk under the gitignored `.claude/dogfood/` in each repo.[^dogfood]

State is a per-loop **append-only JSONL journal**, `.claude/dogfood/<counterpart-id>[.<loop-id>].jsonl`, never edited in place: current state is the last valid line, history is the file, corrections are appends, and a corrupt tail self-heals because every reader walks back to the last parseable line. Mail lands in the receiving repo at `.claude/dogfood/<sender-id>/`, one mailbox per counterpart (not per loop); a mail file may carry a `loop:` frontmatter key routing it to the matching journal, omitting it is the single-loop default. Mailbox and journal are gitignored on both sides.[^dogfood]

**The push guard** (`hooks/pre-tool-use/dogfood-guard.sh`, registered on both `Bash` and the GitKraken/GitHub MCP matcher) scans only the `overrides:` block of `pnpm-workspace.yaml` for a `file:`/`link:` path escaping the repo, and denies on any branch except `dev` (a long-lived integration branch exempt unconditionally). It has no bypass flag — a wrong deny is corrected by appending a `correction` snapshot — because a linked `file:` override is a mechanical fact readable from the tree, never a judgement call.[^dogfood]

**The rules worth knowing before editing this protocol:** mailbox content is never design documentation (the `okf/` bundle is the durable record; a learning worth keeping is promoted there as a concept, written via the `okfit:okf-docs` agent, in a docs pass); claims about an artifact are verified by a stated method (signatures read from the built `.d.ts`, presence checked with a recursive search citing a module path); a multi-package cut is released per package, so `--watch`/`--exit` probe `npm view` once per package; the safety net and the check are never present at the same time — while linked the `file:` override replaces semver resolution outright, and `--exit`'s registry install runs with no net; the opening ball is a fact about the opening mail, not about role; a relay owes its downstream a `status`; a closed loop reopens through `briefing`; it2 is an optional transport, never authoritative — the file mailbox is the source of truth.[^dogfood]

**The repo-level convention this protocol generalizes:** a round consumes the `@effected/*` kit from a sibling checkout's LOCAL prod artifacts via `pnpm-workspace.yaml` `overrides:` entries of the form `"@effected/<name>": "file:../../spencerbeggs/effected/packages/<name>/dist/prod/npm/pkg"`, so kit APIs get shaped against real consumers before release. While overrides are active the branch does not push or open PRs — the paths exist only on the author's machine, mechanically enforced by the push guard above. The exit: effected cuts a live release, the overrides are deleted, `pnpm clean --lockfile && pnpm install` runs against the registry, full verification runs, and only then the finalize workflow (docs, changesets, squash, PR).[^dogfood]

[^plugin]: `../../plugins/silk/.claude-plugin/plugin.json`
[^hooks]: `../../plugins/silk/hooks`
[^changesets]: `../../plugins/silk/skills/changeset`
[^buildtsdoc]: `../../plugins/silk/agents/tsdoctor.md`
[^turbo]: `../../plugins/silk/skills/turbo`
[^it2]: `../../plugins/silk/skills/it2`
[^dogfood]: `../../plugins/silk/skills/dogfood`
