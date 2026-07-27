# @savvy-web/silk

## 3.2.9

### Bug Fixes

* Prevent double import escaping on tsx files

### Patch Changes

Thanks to [@spencerbeggs](https://github.com/spencerbeggs) for their contributions!

## 3.2.8

### Refactoring

* Compacts the always-on `silk_capabilities` SessionStart orientation payload (emitted by `plugins/silk/hooks/session-start/orientation.sh`) from a detailed instruction dump into a compact index, cutting the emitted payload from 7,585 to roughly 3,008 characters. The payload re-fires on every session start, resume, and compact, so the reduction lowers the plugin's fixed context footprint per Anthropic's context-engineering guidance for Claude 5.

  * One line per MCP tool, with parameter and mode detail left to the tool's own schema instead of being spelled out in the payload
  * A one-sentence-per-agent index that keeps the proactive-dispatch nudges
  * A compact skill name list that defers to each skill's frontmatter description
  * A three-line Biome note and a prose active-hooks note in place of the longer prior explanations

### CI

* `hook-tests.yml` no longer runs the removed `plugins/github-actions` hook suite or watches its paths for changes [#393][#393]

### Dependencies

| Dependency           | Type       | Action  | From   | To     |
| -------------------- | ---------- | ------- | ------ | ------ |
| @savvy-web/changelog | dependency | updated | 0.1.1  | 0.1.1  |
| @savvy-web/cli       | dependency | updated | 2.1.11 | 2.1.12 |
| @savvy-web/mcp       | dependency | updated | 2.0.12 | 2.0.13 |

### Patch Changes

Thanks to [@spencerbeggs](https://github.com/spencerbeggs) for their contributions!

[#393]: https://github.com/savvy-web/systems/pull/393

## 3.2.7

### Dependencies

| Dependency           | Type       | Action  | From   | To     |
| -------------------- | ---------- | ------- | ------ | ------ |
| @savvy-web/changelog | dependency | updated | 0.1.1  | 0.1.1  |
| @savvy-web/cli       | dependency | updated | 2.1.10 | 2.1.11 |
| @savvy-web/mcp       | dependency | updated | 2.0.11 | 2.0.12 |

## 3.2.6

### Dependencies

| Dependency           | Type       | Action  | From   | To     |
| -------------------- | ---------- | ------- | ------ | ------ |
| @savvy-web/changelog | dependency | updated | 0.1.1  | 0.1.1  |
| @savvy-web/cli       | dependency | updated | 2.1.9  | 2.1.10 |
| @savvy-web/mcp       | dependency | updated | 2.0.10 | 2.0.11 |

## 3.2.5

### Bug Fixes

* Disable import css warnings on CSS file imports in TSX files

### Patch Changes

Thanks to [@spencerbeggs](https://github.com/spencerbeggs) for their contributions!

## 3.2.4

### Dependencies

| Dependency           | Type       | Action  | From  | To     |
| -------------------- | ---------- | ------- | ----- | ------ |
| @savvy-web/changelog | dependency | updated | 0.1.1 | 0.1.1  |
| @savvy-web/cli       | dependency | updated | 2.1.8 | 2.1.9  |
| @savvy-web/mcp       | dependency | updated | 2.0.9 | 2.0.10 |

* | Dependency          | Type       | Action | From | To     |                                                                       |
  | ------------------- | ---------- | ------ | ---- | ------ | --------------------------------------------------------------------- |
  | @effected/templates | dependency | added  | —    | ^0.1.0 | [#382][#382] Thanks [@spencerbeggs](https://github.com/spencerbeggs)! |

### Patch Changes

[#382]: https://github.com/savvy-web/systems/pull/382

## 3.2.3

### Bug Fixes

* The dogfood mail monitor no longer announces a session's own journal append as an inbound turn — it now surfaces mailbox changes before evaluating journals and suppresses a flip whose triggering mail it had already surfaced on an earlier tick.
* The `repos` pre-tool-use bash guard now recognizes a `git` invocation that names a vendored path within its own clause, instead of requiring an explicit directory flag, so sanctioned `git mv` and `git rm --cached` commands against vendored paths are no longer blocked. A plain `git rm` or a bare `rm` against a vendored path is still denied.

### Documentation

* The dogfood skill states the artifact-verification method — recursive search, citing the module path found, and checking a known-present control symbol before reporting an absence — and adds two protocol rules: a repo that is downstream in one loop and upstream in another owes its downstream a status when its own upstream ships, and a reopened loop may boot from a briefing carrying the current round rather than round zero. The tsdoc skill notes that a verbatim code or type transcription inside a doc comment needs a fenced block, since bare braces and angle brackets are read as TSDoc syntax. [#373][#373]

### Dependencies

| Dependency           | Type       | Action  | From  | To    |
| -------------------- | ---------- | ------- | ----- | ----- |
| @savvy-web/changelog | dependency | updated | 0.1.1 | 0.1.1 |
| @savvy-web/cli       | dependency | updated | 2.1.7 | 2.1.8 |
| @savvy-web/mcp       | dependency | updated | 2.0.8 | 2.0.9 |

### Patch Changes

Thanks to [@spencerbeggs](https://github.com/spencerbeggs) for their contributions!

[#373]: https://github.com/savvy-web/systems/pull/373

## 3.2.2

### Bug Fixes

* The dogfood mail monitor no longer replays a finished collaboration's mail as unread.

  New mail is detected by comparing mailbox files against the journal's `lastMail.in` pointer. When that pointer could not be resolved — it is absent on a loop that has received nothing yet, and stale when a hand-authored journal append names a file that does not exist — the watermark fell back to zero, which made every file in the mailbox count as newer. Reopening a loop against an existing journal therefore surfaced the entire archive of the previous collaboration in one burst.

  The fallback is now the current loop's `loop-started` timestamp, so mail predating the collaboration cannot be new to it.

  * `lastMail.in: null` stays honest for a freshly opened loop instead of having to be back-dated to a previous loop's file to silence the noise
  * A dangling pointer degrades to the same bounded watermark rather than to everything
  * A journal with no `loop-started` line keeps the previous behavior and still surfaces mail [#369][#369]

### Dependencies

| Dependency           | Type       | Action  | From  | To    |
| -------------------- | ---------- | ------- | ----- | ----- |
| @savvy-web/changelog | dependency | updated | 0.1.1 | 0.1.1 |
| @savvy-web/cli       | dependency | updated | 2.1.6 | 2.1.7 |
| @savvy-web/mcp       | dependency | updated | 2.0.7 | 2.0.8 |

### Patch Changes

Thanks to [@spencerbeggs](https://github.com/spencerbeggs) for their contributions!

[#369]: https://github.com/savvy-web/systems/pull/369

## 3.2.1

### Dependencies

| Dependency           | Type       | Action  | From  | To    |
| -------------------- | ---------- | ------- | ----- | ----- |
| @savvy-web/changelog | dependency | updated | 0.1.1 | 0.1.1 |
| @savvy-web/cli       | dependency | updated | 2.1.5 | 2.1.6 |
| @savvy-web/mcp       | dependency | updated | 2.0.6 | 2.0.7 |

* | Dependency | Type       | Action  | From          | To             |                                                                              |
  | ---------- | ---------- | ------- | ------------- | -------------- | ---------------------------------------------------------------------------- |
  | effect     | dependency | updated | 4.0.0-beta.99 | 4.0.0-beta.101 | [#364][#364] Thanks [@savvy-web-bot](https://github.com/apps/savvy-web-bot)! |

### Patch Changes

[#364]: https://github.com/savvy-web/systems/pull/364

## 3.2.0

### Features

* The github-actions plugin now ships an `action-engineer` agent and a
  twelve-skill suite for building Node.js 24 GitHub Actions with
  `@savvy-web/github-action-effects` and `@savvy-web/github-action-builder`.
  The `action-engineering` routing skill maps every job to the owning service
  and skill (and lists the capabilities that deliberately do not exist), and
  the topic skills carry the house patterns distilled from the production
  actions built on this stack: scaffolding from the template repo, `action.config.ts` builds and
  the bundler dependency decision guide, entry-point and layer wiring,
  input reading and validation, machine-readable output contracts with
  generated and drift-tested JSON Schemas, GitHub App authentication across
  pre/main/post, the GitHub API client surface, check runs, job summaries and
  sticky PR comments, step-buffered run logging, tagged-error and cross-phase
  state discipline, and testing with the library's test layers. Deep-dive
  material is vendored into per-skill `references/` files with provenance
  banners, verified against the installed package source. Skill content is
  written for a standalone action repo cloned from `github-action-template`:
  rules are stated directly with self-contained generic examples instead of
  citing sibling-repo precedent, library citations resolve under
  `node_modules/@savvy-web/…`, and example org/repo names are placeholders.

  The SessionStart orientation hook now advertises the agent, the full skill
  index, and the shared savvy-mcp server (and fails open when `jq` is
  missing), and closes with a dogfood-feedback block: it asks the session to
  keep a running log of rough edges in the plugin's own guidance and, only
  with the user's explicit agreement, open an issue against this repo. The
  plugin also gained a BATS + shellcheck suite wired into `pnpm test:hooks`
  and the Hook Tests workflow, covering the orientation payload's skill
  roster and the agent's skill-registration frontmatter. [#355][#355]

### Minor Changes

Thanks to [@spencerbeggs](https://github.com/spencerbeggs) for their contributions!

[#355]: https://github.com/savvy-web/systems/pull/355

## 3.1.2

### Dependencies

| Dependency           | Type       | Action  | From  | To    |
| -------------------- | ---------- | ------- | ----- | ----- |
| @savvy-web/changelog | dependency | updated | 0.1.1 | 0.1.1 |
| @savvy-web/cli       | dependency | updated | 2.1.4 | 2.1.5 |
| @savvy-web/mcp       | dependency | updated | 2.0.5 | 2.0.6 |

## 3.1.1

### Dependencies

| Dependency           | Type       | Action  | From  | To    |
| -------------------- | ---------- | ------- | ----- | ----- |
| @savvy-web/changelog | dependency | updated | 0.1.1 | 0.1.1 |
| @savvy-web/cli       | dependency | updated | 2.1.3 | 2.1.4 |
| @savvy-web/mcp       | dependency | updated | 2.0.4 | 2.0.5 |

* | Dependency | Type       | Action  | From   | To     |                                                                              |
  | ---------- | ---------- | ------- | ------ | ------ | ---------------------------------------------------------------------------- |
  | prettier   | dependency | updated | ^3.9.5 | ^3.9.6 | [#349][#349] Thanks [@savvy-web-bot](https://github.com/apps/savvy-web-bot)! |

### Patch Changes

[#349]: https://github.com/savvy-web/systems/pull/349

## 3.1.0

### Features

* Added a `/silk:it2` skill for orchestrating iTerm2 panes and windows when
  running subagents — pinned split-direction semantics, a layout heuristic for
  matching pane geometry, grid recipes, badging, and dismiss-and-close
  discipline for torn-down subagents. It drives the raw `it2` CLI directly and
  does not require the separate `it2-skills` marketplace plugin.

### Bug Fixes

* The SessionStart `<terminal>` orientation block now only renders when the
  session is actually running in iTerm2 with the `it2` CLI on `PATH` (checked
  from environment variables alone, with no `it2` subprocess invoked from the
  hook). Previously the block appeared unconditionally, pointing users at the
  `it2` CLI even in terminals where it wasn't installed or usable. When the
  gate passes, the block also now teaches proactive pane orchestration for
  spawned subagents and points to the new `/silk:it2` skill. [#347][#347]

### Minor Changes

Thanks to [@spencerbeggs](https://github.com/spencerbeggs) for their contributions!

[#347]: https://github.com/savvy-web/systems/pull/347

## 3.0.6

### Dependencies

| Dependency           | Type       | Action  | From  | To    |
| -------------------- | ---------- | ------- | ----- | ----- |
| @savvy-web/changelog | dependency | updated | 0.1.1 | 0.1.1 |
| @savvy-web/cli       | dependency | updated | 2.1.2 | 2.1.3 |
| @savvy-web/mcp       | dependency | updated | 2.0.3 | 2.0.4 |

* | Dependency        | Type           | Action  | From    | To      |                                                                       |
  | ----------------- | -------------- | ------- | ------- | ------- | --------------------------------------------------------------------- |
  | lint-staged       | peerDependency | updated | ^17.0.8 | ^17.1.0 |                                                                       |
  | markdownlint-cli2 | peerDependency | updated | ^0.23.0 | ^0.23.1 | [#342][#342] Thanks [@spencerbeggs](https://github.com/spencerbeggs)! |

### Patch Changes

[#342]: https://github.com/savvy-web/systems/pull/342

## 3.0.5

### Dependencies

| Dependency           | Type       | Action  | From  | To    |
| -------------------- | ---------- | ------- | ----- | ----- |
| @savvy-web/changelog | dependency | updated | 0.1.1 | 0.1.1 |
| @savvy-web/cli       | dependency | updated | 2.1.1 | 2.1.2 |
| @savvy-web/mcp       | dependency | updated | 2.0.2 | 2.0.3 |

## 3.0.4

### Dependencies

| Dependency           | Type       | Action  | From  | To    |
| -------------------- | ---------- | ------- | ----- | ----- |
| @savvy-web/changelog | dependency | updated | 0.1.1 | 0.1.1 |
| @savvy-web/cli       | dependency | updated | 2.1.0 | 2.1.1 |
| @savvy-web/mcp       | dependency | updated | 2.0.1 | 2.0.2 |

* | Dependency | Type       | Action  | From          | To            |                                                                              |
  | ---------- | ---------- | ------- | ------------- | ------------- | ---------------------------------------------------------------------------- |
  | effect     | dependency | updated | 4.0.0-beta.98 | 4.0.0-beta.99 | [#326][#326] Thanks [@savvy-web-bot](https://github.com/apps/savvy-web-bot)! |

### Patch Changes

[#326]: https://github.com/savvy-web/systems/pull/326

## 3.0.3

### Bug Fixes

* Hardens the bundled `changeset-manager` agent so it no longer stalls or silently drops files when dispatched without an interactive surface.

  * The `AskUserQuestion` step is now conditional — it asks when the tool is available and otherwise escalates genuinely ambiguous files to the dispatching agent via `SendMessage` instead of silently excluding them.
  * A brand-new workspace package is treated as a first-class content changeset with its own single-package `minor` entry, and the content pass now runs before the dependency pass so a new package is announced before any dependency edge that references it.
  * The report step now enumerates every changed package that received no changeset along with the rationale, so an early stop can never be mistaken for "nothing needed". [#317][#317]

- The dogfood-mail monitor no longer re-fires the "your turn" alert for a finished loop whose journal ends on the terminal `unlinked` phase, so a completed loop stays quiescent across new sessions. Appending a fresh loop line reopens it deliberately. [#317][#317]

### Dependencies

| Dependency     | Type       | Action  | From  | To    |
| -------------- | ---------- | ------- | ----- | ----- |
| @savvy-web/cli | dependency | updated | 2.0.1 | 2.1.0 |

### Patch Changes

Thanks to [@spencerbeggs](https://github.com/spencerbeggs) for their contributions!

[#317]: https://github.com/savvy-web/systems/pull/317

## 3.0.2

### Dependencies

| Dependency           | Type       | Action  | From  | To    |
| -------------------- | ---------- | ------- | ----- | ----- |
| @savvy-web/changelog | dependency | updated | 0.1.1 | 0.1.1 |
| @savvy-web/cli       | dependency | updated | 2.0.1 | 2.0.1 |
| @savvy-web/mcp       | dependency | updated | 2.0.1 | 2.0.1 |

* | Dependency | Type           | Action  | From    | To      |                                                          |
  | ---------- | -------------- | ------- | ------- | ------- | -------------------------------------------------------- |
  | turbo      | peerDependency | updated | ^2.10.4 | ^2.10.5 | Thanks [@spencerbeggs](https://github.com/spencerbeggs)! |

## 3.0.1

### Dependencies

| Dependency           | Type       | Action  | From  | To    |
| -------------------- | ---------- | ------- | ----- | ----- |
| @savvy-web/changelog | dependency | updated | 0.1.1 | 0.1.1 |
| @savvy-web/cli       | dependency | updated | 2.0.0 | 2.0.1 |
| @savvy-web/mcp       | dependency | updated | 2.0.0 | 2.0.1 |

## 3.0.0

### Breaking Changes

* The install target re-exports `@savvy-web/silk-effects`' v4 surface; consumers pick up the v4 `effect` generation and the reshaped service, schema, and error types. [#312][#312]

### Dependencies

| Dependency           | Type       | Action  | From  | To    |
| -------------------- | ---------- | ------- | ----- | ----- |
| @savvy-web/changelog | dependency | updated | 0.1.1 | 0.1.1 |
| @savvy-web/cli       | dependency | updated | 1.6.1 | 2.0.0 |
| @savvy-web/mcp       | dependency | updated | 1.8.1 | 2.0.0 |

* | Dependency       | Type       | Action  | From    | To             |                                                                       |
  | ---------------- | ---------- | ------- | ------- | -------------- | --------------------------------------------------------------------- |
  | @effect/platform | dependency | removed | ^0.96.2 | —              |                                                                       |
  | effect           | dependency | updated | ^3.21.4 | catalog:effect | [#312][#312] Thanks [@spencerbeggs](https://github.com/spencerbeggs)! |

### Patch Changes

Thanks to [@spencerbeggs](https://github.com/spencerbeggs) for their contributions!

[#312]: https://github.com/savvy-web/systems/pull/312

## 2.5.0

### Features

* ### `/silk:dogfood` skill

  A new skill for running a cross-repo "dogfood loop" — requesting, delivering, adopting, and iterating on changes from a sibling repo checkout (e.g. a package consumed via a temporary `file:` override) before anything is released. Supports `--init`, `--send <kind>`, `--status`, `--watch`, `--adopt`, and `--exit`, backed by a mailbox protocol (markdown mail files under `.claude/dogfood/`) and a per-loop JSONL state journal that tracks whose turn it is.

  ### Dogfood guard hook

  A new `PreToolUse` hook denies `git push` and pull-request creation (via `Bash`, the GitKraken MCP, and the GitHub MCP) while a downstream dogfood loop has active `file:` overrides linked in, preventing a branch with unreleased local artifacts from being pushed or opened as a PR.

  ### Dogfood mail monitor

  A new background monitor surfaces incoming `.claude/dogfood/` mail and journal turn-flips as they arrive.

### Dependencies

| Dependency           | Type       | Action  | From  | To    |
| -------------------- | ---------- | ------- | ----- | ----- |
| @savvy-web/changelog | dependency | updated | 0.1.1 | 0.1.1 |
| @savvy-web/cli       | dependency | updated | 1.6.1 | 1.6.1 |
| @savvy-web/mcp       | dependency | updated | 1.8.1 | 1.8.1 |

### Maintenance

* Session-start orientation now mentions the new `/silk:dogfood` skill and the two active background monitors, adds an it2 terminal-control hint, and reminds agents to clean up idle sessions/panes they spawned. [#309][#309]

### Patch Changes

Thanks to [@spencerbeggs](https://github.com/spencerbeggs) for their contributions!

[#309]: https://github.com/savvy-web/systems/pull/309

## 2.4.4

### Dependencies

* | Dependency                | Type           | Action  | From    | To            |                                                          |
  | ------------------------- | -------------- | ------- | ------- | ------------- | -------------------------------------------------------- |
  | @changesets/cli           | peerDependency | updated | ^3.0.0  | ^3.0.0-next.8 |                                                          |
  | @types/node               | peerDependency | updated | ^26.1.0 | ^26.1.1       |                                                          |
  | typescript                | peerDependency | updated | ^7.0.0  | ^7.0.2        |                                                          |
  | @vitest/coverage-istanbul | peerDependency | added   | —       | ^4.1.10       |                                                          |
  | @vitest/coverage-v8       | peerDependency | added   | —       | ^4.1.10       |                                                          |
  | tsx                       | peerDependency | added   | —       | ^4.23.1       |                                                          |
  | vitest                    | peerDependency | added   | —       | ^4.1.10       | Thanks [@spencerbeggs](https://github.com/spencerbeggs)! |

## 2.4.3

### Dependencies

| Dependency           | Type       | Action  | From  | To    |
| -------------------- | ---------- | ------- | ----- | ----- |
| @savvy-web/changelog | dependency | updated | 0.1.1 | 0.1.1 |
| @savvy-web/cli       | dependency | updated | 1.6.1 | 1.6.1 |
| @savvy-web/mcp       | dependency | updated | 1.8.1 | 1.8.1 |

* | Dependency      | Type           | Action  | From          | To      |                                                          |
  | --------------- | -------------- | ------- | ------------- | ------- | -------------------------------------------------------- |
  | @changesets/cli | peerDependency | updated | ^3.0.0-next.8 | ^3.0.0  |                                                          |
  | @types/bun      | peerDependency | added   | —             | ^1.3.14 | Thanks [@spencerbeggs](https://github.com/spencerbeggs)! |

## 2.4.2

### Dependencies

| Dependency           | Type       | Action  | From  | To    |
| -------------------- | ---------- | ------- | ----- | ----- |
| @savvy-web/changelog | dependency | updated | 0.1.1 | 0.1.1 |
| @savvy-web/cli       | dependency | updated | 1.6.0 | 1.6.1 |
| @savvy-web/mcp       | dependency | updated | 1.8.0 | 1.8.1 |

## 2.4.1

### Bug Fixes

* Bump `@changesets/cli` peer dependency to correct range.

### Patch Changes

Thanks to [@spencerbeggs](https://github.com/spencerbeggs) for their contributions!

## 2.4.0

### Features

* ### `.repos/` support: Biome exclusion, orientation hook, write guards, and skill

  The Biome preset now excludes `**/.repos` from processing, so vendored repo content stays searchable by other tools without ever being gitignored or reformatted.

  The bundled Claude Code plugin gains full support for the vendored-repos pattern:

  * A session-start hook that runs a best-effort `savvy repos sync` and injects a per-repo orientation block (purpose, layout, key paths, notes) into context on every session start, resume, and compact — budgeted at 2000 characters, with per-repo entries falling back to a one-line summary once the budget is exceeded.
  * Three `PreToolUse` write guards for `.repos/**`: a hard-deny for file-editing tools (with `.repos/config.json` itself exempted), and best-effort tripwires over Bash and MCP git-style tools — enforcing that vendored repos stay read-only-by-convention.
  * A new `/silk:repos` skill covering when to vendor a repo, sparse-checkout discipline, the re-pin-on-dependency-bump rule, and the orientation/notes editorial policy. Auto-loads whenever `.repos/config.json` is present. [#292][#292]

- ### Consolidated `silk_capabilities` orientation

  The always-on SessionStart hook now emits a single `<silk_capabilities>` block instead of the old fragmented `workspace_info`/`turbo_inspect`/Biome/changesets-plugin sections: the full ten-tool savvy-mcp index, the three-agent index, the eight-skill index, the Biome LSP/`biome_check`/Bash division of labor, and an active-hooks map (commit guards, the Biome nudge, the `.repos/**` write guards, changeset validation, the missing-changeset note). It's a net reduction in context size while adding coverage for `savvy commit`, `tsdoctor`, `/silk:build`, and the vendored-repos pattern that the old payload didn't mention.

  ### `tsdoctor` and `turborepo` agents gain direct Biome access

  Both agents now carry `mcp__plugin_silk_savvy-mcp__biome_check` in their tool allowlist, so they can run structured Biome checks and fixes directly instead of shelling out to Bash.

  ### `/silk:repos` pointer in vendored-repos orientation

  The per-session vendored-repos block now points at the `/silk:repos` skill for the judgment layer — when to vendor, sparse-checkout discipline, the re-pin rule, and notes editorial policy.

### Bug Fixes

* ### SessionStart producer now resolves the working tree worktree-correctly

  The always-on SessionStart hook — the producer of `SILK_PROJECT_DIR` and `SILK_PACKAGE_MANAGER` for every reader hook — previously ranked `CLAUDE_PROJECT_DIR` above the hook envelope's `cwd`, pinning a git-worktree session to the primary checkout's path and package manager for its whole life. It now resolves through the shared `resolve_project_dir` (envelope `cwd` first), and package-manager detection is deduplicated into the shared hook library with a uniform fail-open-to-npm posture across both SessionStart hooks.

  ### Corrected pre-commit and tool-preference guidance

  The startup context's tool-preference guidance previously taught Bash `biome check` as the primary path and wrongly claimed the root `typecheck` script runs `tsgo` directly. It now states the correct order — Biome LSP first (automatic diagnostics on edit), `biome_check` second (structured, can fix), Bash as the escape hatch — and adds a `pre_commit_pipeline` block enumerating every lint-staged autofix that runs on commit, including the intentional exec-bit strip on `.sh` files, so agents stop mistaking that mode flip for damage. [#299][#299]

### Documentation

* Documents that plugin hook scripts intentionally commit without an executable bit (`100644`). The lint-staged `ShellScripts` handler strips the exec bit from staged `.sh` files, and every hook is invoked as `bash "${CLAUDE_PLUGIN_ROOT}/hooks/..."`, so the bit is never exercised. Prevents mistaking a `644` mode on a hook script for accidental permission drift during review. [#299][#299]

### Dependencies

| Dependency           | Type       | Action  | From   | To    |
| -------------------- | ---------- | ------- | ------ | ----- |
| @savvy-web/changelog | dependency | updated | 0.1.1  | 0.1.1 |
| @savvy-web/cli       | dependency | updated | 1.5.10 | 1.6.0 |
| @savvy-web/mcp       | dependency | updated | 1.7.6  | 1.8.0 |

* | Dependency      | Type           | Action  | From          | To     |                                                          |
  | --------------- | -------------- | ------- | ------------- | ------ | -------------------------------------------------------- |
  | @changesets/cli | peerDependency | updated | ^3.0.0-next.8 | ^3.0.0 | Thanks [@spencerbeggs](https://github.com/spencerbeggs)! |

### Patch Changes

Thanks to [@spencerbeggs](https://github.com/spencerbeggs) for their contributions!

[#292]: https://github.com/savvy-web/systems/pull/292

[#299]: https://github.com/savvy-web/systems/pull/299

## 2.3.2

### Dependencies

| Dependency           | Type       | Action  | From  | To     |
| -------------------- | ---------- | ------- | ----- | ------ |
| @savvy-web/changelog | dependency | updated | 0.1.1 | 0.1.1  |
| @savvy-web/cli       | dependency | updated | 1.5.9 | 1.5.10 |
| @savvy-web/mcp       | dependency | updated | 1.7.5 | 1.7.6  |

## 2.3.1

### Dependencies

| Dependency           | Type       | Action  | From  | To    |
| -------------------- | ---------- | ------- | ----- | ----- |
| @savvy-web/changelog | dependency | updated | 0.1.1 | 0.1.1 |
| @savvy-web/cli       | dependency | updated | 1.5.8 | 1.5.9 |
| @savvy-web/mcp       | dependency | updated | 1.7.4 | 1.7.5 |

* | Dependency                 | Type           | Action  | From                  | To      |                                                                       |
  | -------------------------- | -------------- | ------- | --------------------- | ------- | --------------------------------------------------------------------- |
  | @typescript/native-preview | peerDependency | removed | ^7.0.0-dev.20260612.1 | —       |                                                                       |
  | commitizen                 | peerDependency | removed | ^4.3.2                | —       |                                                                       |
  | prettier                   | dependency     | updated | ^3.9.4                | ^3.9.5  |                                                                       |
  | @commitlint/cli            | peerDependency | updated | ^21.2.0               | ^21.2.1 |                                                                       |
  | turbo                      | peerDependency | updated | ^2.10.2               | ^2.10.4 |                                                                       |
  | typescript                 | peerDependency | updated | ^6.0.0                | ^7.0.0  | [#278][#278] Thanks [@spencerbeggs](https://github.com/spencerbeggs)! |

### Patch Changes

[#278]: https://github.com/savvy-web/systems/pull/278

## 2.3.0

### Breaking Changes

* The `changeset-push-guard` PreToolUse hook is removed. No hook blocks a commit or a push for a missing changeset any more. Whether a change needs a changeset is a human judgement — a hook can only see "commits exist, no changeset file", which cannot distinguish a user-facing fix from a docs-only branch, so blocking on that signal was wrong for a large and legitimate class of branches. Enforcement belongs in CI on the pull request, where the full diff is available and an override is an explicit, reviewable human act. The `SILK_SKIP_PUSH_CHECK` environment variable is retired with it and no longer does anything.

### Features

* The `commit-create` skill now ships two bundled scripts. `scripts/validate-message.sh` measures every line of a candidate commit message against the real thresholds (reporting exact line numbers and lengths) and then gates on the actual commitlint preset, so it cannot drift from the rules the `commit-msg` hook enforces. `scripts/commit.sh` validates and, only on success, execs `git commit` in the same process — there is no separate step to skip, and it refuses `--no-verify`. The skill now mandates the wrapper as the only commit path.
* The `build` skill now auto-loads on `**/package.json` and `**/turbo.json` as well as `**/savvy.build.ts`. Because those globs fire on files that have nothing to do with the bundler, it opens with a concrete check for whether the file belongs to a `@savvy-web/bundler` or `@savvy-web/rspress-builder` package and tells the agent to move on if not. It documents the package.json script contract, the `prepare` rule, and what `turbo.json`'s `dependsOn` does and does not order.

- New `Stop` hook `stop/changeset-nudge.sh` replaces the push guard with a non-blocking reminder. When a main-agent turn ends on a branch that has commits but no changeset, it emits a top-level `systemMessage` — shown to the user, not injected into the model's context. It emits no decision and no `additionalContext`, so it cannot block the turn and does not instruct the agent. It is debounced on `HEAD`, so it speaks once per commit state rather than once per turn, and because `SubagentStop` is a separate event, a subagent making many commits never triggers it. Set `SILK_SKIP_CHANGESET_NUDGE=1` to opt out.
- SessionStart orientation now directs the agent to the MCP tools as the source of truth for release state — `changeset_inspect` for the classified branch diff, `changeset_preview` for the rendered CHANGELOG, `changeset_deps_detect` and `workspace_info` — instead of inferring it from the file tree. It also no longer claims a commit-time changeset reminder exists, which was never implemented.

### Bug Fixes

* Hooks now resolve the working tree from the hook envelope's `cwd` rather than `CLAUDE_PROJECT_DIR`, via a new shared `hooks/lib/hook-env.sh`. `CLAUDE_PROJECT_DIR` is pinned to the session's primary checkout and does not track the directory a tool call runs in, so any hook reasoning about git state from it inspected the wrong tree whenever an agent worked in a git worktree. This affected `commit-fs` and the changeset-validate post-tool hook. Note that `SILK_PROJECT_DIR` is derived from `CLAUDE_PROJECT_DIR` and carries the same limitation, so it ranks below `cwd` in the new resolution order.
* All jq-parsing hooks now fail open on invalid JSON from stdin instead of aborting under `set -euo pipefail` with jq's exit 5. Previously only a missing jq binary was guarded.
* `commit-fs.sh` no longer aborts with an unbound-variable error when `CLAUDE_PROJECT_DIR` is unset; it fails open like every other hook.
* The force-push exclusion in `match-safe-bash.sh` now anchors its `-f` match as a whole token. The unanchored version substring-matched inside other arguments, so `git push --follow-tags` and any push to a branch whose name contains `-f` (`my-feature`, `add-fix`) were knocked off the auto-allow hot path and prompted unnecessarily. Genuine force-pushes, including `--force-with-lease` and `--force-if-includes`, remain excluded.
* Every hook in `hooks.json` now declares an explicit `timeout`; four previously fell back to the 60s default. [#276][#276]

- The `commit-create` skill told agents to write each body paragraph as one continuous line because "the 300-character-per-line limit makes wrapping unnecessary". That guidance walked agents straight into `body-max-line-length` rejections, which surface only after a full lint-staged cycle. It now gives a safe target well below the ceiling and points at the validator rather than asking agents to eyeball a 300-character limit.
- The `commit-create` skill claimed subject case was enforced. It is not — `subject-case` is explicitly disabled in the Silk preset. Corrected to a style preference.
- The `commit-create` skill never documented `footer-max-line-length` (100 characters), which applies to trailer lines including `Signed-off-by` and `Closes`, and can reject a commit on its own.
- The plugin's test harness now shellchecks skill scripts under `skills/`, not just `hooks/`, `bin/`, and `tests/`. The bundled `skills/changeset/scripts/list.sh` had never been linted by the harness. [#276][#276]

### Dependencies

| Dependency     | Type       | Action  | From  | To    |
| -------------- | ---------- | ------- | ----- | ----- |
| @savvy-web/cli | dependency | updated | 1.5.7 | 1.5.8 |

### Patch Changes

Thanks to [@spencerbeggs](https://github.com/spencerbeggs) for their contributions!

[#276]: https://github.com/savvy-web/systems/pull/276

## 2.2.4

### Bug Fixes

* The GitKraken MCP auto-allow matcher in `hooks.json` only ever matched `mcp__gk__*`, a prefix no real GitKraken MCP server registers under — the allowlist never fired and every GitKraken read op prompted for permission. The matcher now also covers `mcp__gitkraken__*` and `mcp__GitKraken__*`, so read-only ops (`git_status`, `git_log_or_diff`, and friends) are auto-allowed. `git_add_or_commit` and `git_push` are deliberately left off the auto-allow list so MCP-driven commits and pushes still prompt — auto-allowing them would bypass commit-message validation and the changeset-push-guard.
* `allowed-tools` in the `commit-create`, `config`, and `dependencies` skills is normalized from space-separated to comma-separated, fixing a grant that risked being mis-parsed. `config` also drops an unused `changeset_validate` grant, and the `turborepo` agent drops its dead `ListMcpResourcesTool`/`ReadMcpResourceTool` grants now that `savvy-mcp` is tools-only.
* The `status` skill no longer references `/silk:update`, `/silk:merge`, or `/silk:delete` — those are internal mechanics invoked by the changeset-manager agent, not user-facing commands. It now points at `/silk:changeset --create` and `/silk:changeset --squash` instead. [#273][#273]

### Dependencies

| Dependency           | Type       | Action  | From  | To    |
| -------------------- | ---------- | ------- | ----- | ----- |
| @savvy-web/changelog | dependency | updated | 0.1.1 | 0.1.1 |
| @savvy-web/cli       | dependency | updated | 1.5.6 | 1.5.7 |
| @savvy-web/mcp       | dependency | updated | 1.7.3 | 1.7.4 |

### Patch Changes

Thanks to [@spencerbeggs](https://github.com/spencerbeggs) for their contributions!

[#273]: https://github.com/savvy-web/systems/pull/273

## 2.2.3

### Bug Fixes

* The `changeset-manager`, `tsdoctor`, and `turborepo` plugin agents now include `SendMessage` in their `tools:` frontmatter, so when dispatched as teammates they can report results back to the orchestrator and answer a `shutdown_request` instead of idle-looping until the session ends. [#265][#265]

### Dependencies

| Dependency           | Type       | Action  | From  | To    |
| -------------------- | ---------- | ------- | ----- | ----- |
| @savvy-web/changelog | dependency | updated | 0.1.1 | 0.1.1 |
| @savvy-web/cli       | dependency | updated | 1.5.5 | 1.5.6 |
| @savvy-web/mcp       | dependency | updated | 1.7.2 | 1.7.3 |

### Patch Changes

Thanks to [@spencerbeggs](https://github.com/spencerbeggs) for their contributions!

[#265]: https://github.com/savvy-web/systems/pull/265

## 2.2.2

### Dependencies

| Dependency           | Type       | Action  | From  | To    |
| -------------------- | ---------- | ------- | ----- | ----- |
| @savvy-web/changelog | dependency | updated | 0.1.1 | 0.1.1 |
| @savvy-web/cli       | dependency | updated | 1.5.4 | 1.5.5 |
| @savvy-web/mcp       | dependency | updated | 1.7.1 | 1.7.2 |

## 2.2.1

### Dependencies

| Dependency           | Type       | Action  | From  | To    |
| -------------------- | ---------- | ------- | ----- | ----- |
| @savvy-web/changelog | dependency | updated | 0.1.1 | 0.1.1 |
| @savvy-web/cli       | dependency | updated | 1.5.3 | 1.5.4 |
| @savvy-web/mcp       | dependency | updated | 1.7.0 | 1.7.1 |

## 2.2.0

### Breaking Changes

* ### Changeset commands consolidated into a single `/silk:changeset` router

  The five separate changeset slash commands are removed and replaced by one flag-driven command. Anyone with muscle memory or scripts invoking the old command names must switch to the new form:

  | Old command                                                                 | New command                                                                   |
  | --------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
  | `/silk:changeset-create [--require] [--package N] [--bump LVL] [--dry-run]` | `/silk:changeset --create [--require] [--package N] [--bump LVL] [--dry-run]` |
  | `/silk:changeset-squash [branch\|all] [--package N] [--dry-run]`            | `/silk:changeset --squash [branch\|all] [--package N] [--dry-run]`            |
  | `/silk:changeset-check`                                                     | `/silk:changeset --check`                                                     |
  | `/silk:changeset-list`                                                      | `/silk:changeset --list`                                                      |
  | `/silk:changeset-preview`                                                   | `/silk:changeset --preview`                                                   |

  A bare `/silk:changeset` (no flag) defaults to create/reconcile. `/silk:changeset-style` is unaffected and keeps its own name.

### Features

* ### New `build` skill

  `/silk:build` documents configuring and running `@savvy-web/bundler` (and its `rspress-builder` sibling) from a `savvy.build.ts` — the `build()` front door, the full `BuildConfig` option surface, `build:dev`/`build:prod`/`types:check`/`prepare` workspace and Turborepo wiring, SEA executables, and the API Extractor meta pass. It auto-loads whenever `savvy.build.ts` is opened.

  ### New `changeset-config` skill

  `/silk:changeset-config` documents `.changeset/config.json` in a Silk repo — the two-element `changelog` tuple, the standard `@changesets/config` fields, and the Silk-custom per-package `versionFiles` and `additionalScopes` options. It auto-loads whenever `.changeset/config.json` is opened. [#253][#253]

### Bug Fixes

* Hardens the silk plugin's Biome nudge hook and tsdoc monitor so they stop pointing agents at actions they cannot take, or should not take yet.

  * The `biome_check` nudge no longer fires inside subagents. Subagents run with a curated `tools:` allowlist and often cannot call the MCP tool the nudge recommends, so the reminder was a dead end.
  * The nudge now matches Biome only when it is the invoked binary, not when the word "biome" merely appears as an argument — for example inside a `gh issue create --body` text.
  * The tsdoc monitor debounces: it waits for a package's ae-\*/tsdoc- count to hold steady across a short quiet period before notifying, so an agent actively fixing diagnostics no longer triggers churn. The notification also tells the reader to let an in-flight fix finish before dispatching another. [#250][#250]

- Hardens the `tsdoctor` agent so a multi-step run (build → read `issues.json` → edit → rebuild) reliably finishes in a single dispatch and catches two header-comment mistakes the diagnostic-driven loop was missing.

  * Turn-discipline contract: the agent no longer ends a turn on a statement of intent — it must run the final verifying build, confirm the filtered `ae-*`/`tsdoc-*` arrays are empty, and deliver the report as its last message.
  * Proactive `@packageDocumentation` sweep: greps the package `src` and confirms every occurrence sits in an `exports`-entry file, since a stray tag on a non-entry file raises no diagnostic.
  * Comment-style rule: module-header narration on non-entry files (especially `internal/*`) must use `//` line comments, not `/** */` doc blocks, which API Extractor parses and can misattribute. [#249][#249]

### Patch Changes

Thanks to [@spencerbeggs](https://github.com/spencerbeggs) for their contributions!

[#249]: https://github.com/savvy-web/systems/pull/249

[#250]: https://github.com/savvy-web/systems/pull/250

[#253]: https://github.com/savvy-web/systems/pull/253

## 2.1.3

### Bug Fixes

* The published manifest no longer promotes `@savvy-web/changelog`, `@savvy-web/cli`, and `@savvy-web/mcp` from `dependencies` to `peerDependencies`. Promoting them to peers let pnpm's `autoInstallPeers` propagate their Effect dependency graph into consuming repos at versions `@savvy-web/silk` didn't control. They now ship as regular, exact-pinned `dependencies` instead — the exact-version coupling via `workspace:*` is unchanged, only the manifest field. `@savvy-web/pnpm-plugin-silk` already hoists all three publicly, so their bins remain available to consumers either way. [#245][#245]

### Documentation

* The `changeset-manager` agent gains a sixth exclusion category, cross-package documentation drift, and a new rule requiring code examples in changesets to match the real API surface. The `config` skill's exclusion-category list is updated to match (five categories → six).
* The `tsdoc` skill's `ae-forgotten-export` guidance now distinguishes an in-package unexported type from an externally-inlined dependency type — each needs a different fix. The `ae-missing-release-tag` guidance now documents the `export * as NS` / `_d_exports` limitation and its sanctioned `suppressWarnings` workaround. [#238][#238]

### Dependencies

| Dependency           | Type       | Action  | From  | To    |
| -------------------- | ---------- | ------- | ----- | ----- |
| @savvy-web/changelog | dependency | updated | 0.1.0 | 0.1.1 |
| @savvy-web/cli       | dependency | updated | 1.5.2 | 1.5.3 |
| @savvy-web/mcp       | dependency | updated | 1.6.7 | 1.7.0 |

### Patch Changes

Thanks to [@spencerbeggs](https://github.com/spencerbeggs) for their contributions!

[#238]: https://github.com/savvy-web/systems/pull/238

[#245]: https://github.com/savvy-web/systems/pull/245

## 2.1.2

### Dependencies

| Dependency           | Type       | Action  | From  | To    |
| -------------------- | ---------- | ------- | ----- | ----- |
| @savvy-web/changelog | dependency | updated | 0.1.0 | 0.1.0 |
| @savvy-web/cli       | dependency | updated | 1.5.1 | 1.5.2 |
| @savvy-web/mcp       | dependency | updated | 1.6.6 | 1.6.7 |

## 2.1.1

### Dependencies

| Dependency           | Type       | Action  | From  | To    |
| -------------------- | ---------- | ------- | ----- | ----- |
| @savvy-web/changelog | dependency | updated | 0.1.0 | 0.1.0 |
| @savvy-web/cli       | dependency | updated | 1.5.0 | 1.5.1 |
| @savvy-web/mcp       | dependency | updated | 1.6.5 | 1.6.6 |

## 2.1.0

### Features

* ### @savvy-web/changelog ships as a peer companion

  `@savvy-web/silk` now declares `@savvy-web/changelog` as a peer dependency alongside `@savvy-web/cli` and `@savvy-web/mcp` — installing `@savvy-web/silk` brings in the standalone changesets changelog generator as part of the same peer group.

### Bug Fixes

* The `./changesets/changelog` and `./changesets/markdownlint` subpath artifacts are now genuinely self-contained ESM builds (via the `@savvy-web/tsdown-plugins` fix) — the previously-published ESM variants of these subpaths silently broke once packed with `npm pack`.

### Dependencies

| Dependency           | Type       | Action  | From  | To    |
| -------------------- | ---------- | ------- | ----- | ----- |
| @savvy-web/changelog | dependency | updated | 0.0.0 | 0.1.0 |
| @savvy-web/cli       | dependency | updated | 1.4.4 | 1.5.0 |
| @savvy-web/mcp       | dependency | updated | 1.6.4 | 1.6.5 |

* | Dependency           | Type      | Action | From | To    |                                                                       |
  | :------------------- | :-------- | :----- | :--- | :---- | --------------------------------------------------------------------- |
  | @savvy-web/changelog | workspace | added  | —    | 0.1.0 | [#223][#223] Thanks [@spencerbeggs](https://github.com/spencerbeggs)! |

### Patch Changes

[#223]: https://github.com/savvy-web/systems/pull/223

## 2.0.0

### Breaking Changes

* Ships `@changesets/cli@^3.0.0-next.8` to consumers (was `^2.31.0`) as both a `devDependency` and `peerDependency`. The v3 CLI is a significant contract change for anyone consuming this package:

  * **ESM-only.** The CLI no longer ships a CommonJS build — projects invoking it programmatically must be able to `import` it.
  * **Node >=22.11 required.** Consumers on older Node LTS lines will need to upgrade before adopting this version.
  * **`changeset tag` is renamed `changeset git-tag`.** Any script or CI step invoking `changeset tag` must be updated to the new subcommand name.

### Dependencies

| Dependency     | Type       | Action  | From  | To    |
| -------------- | ---------- | ------- | ----- | ----- |
| @savvy-web/cli | dependency | updated | 1.4.3 | 1.4.4 |
| @savvy-web/mcp | dependency | updated | 1.6.3 | 1.6.4 |

* | Dependency      | Type           | Action  | From    | To            |                                                                       |
  | --------------- | -------------- | ------- | ------- | ------------- | --------------------------------------------------------------------- |
  | @changesets/cli | peerDependency | updated | ^2.31.0 | ^3.0.0-next.8 | [#218][#218] Thanks [@spencerbeggs](https://github.com/spencerbeggs)! |

### Maintenance

* The force-bundled CJS entries (`./changesets/changelog`, `./changesets/markdownlint`) now steer `jsonc-parser` — pulled in transitively by the v3 engine — to its ESM build at bundle time. Its UMD `main` entry survives rolldown's single-file CJS output with unresolvable relative `require("./impl/*")` calls, which made both entries throw `Cannot find module` at load.

### Patch Changes

[#218]: https://github.com/savvy-web/systems/pull/218

## 1.3.11

### Dependencies

| Dependency     | Type       | Action  | From  | To    |
| -------------- | ---------- | ------- | ----- | ----- |
| @savvy-web/cli | dependency | updated | 1.4.2 | 1.4.3 |
| @savvy-web/mcp | dependency | updated | 1.6.2 | 1.6.3 |

* | Dependency                      | Type           | Action  | From    | To      |
  | ------------------------------- | -------------- | ------- | ------- | ------- |
  | @commitlint/cli                 | peerDependency | updated | ^21.1.0 | ^21.2.0 |
  | @commitlint/config-conventional | peerDependency | updated | ^21.1.0 | ^21.2.0 |
  | @types/node                     | peerDependency | updated | ^26.0.0 | ^26.1.0 |
  | commitizen                      | peerDependency | updated | ^4.3.0  | ^4.3.2  |
  | lint-staged                     | peerDependency | updated | ^17.0.7 | ^17.0.8 |
  | markdownlint-cli2               | peerDependency | updated | ^0.22.1 | ^0.23.0 |
  | turbo                           | peerDependency | updated | ^2.10.0 | ^2.10.2 |

## 1.3.10

### Patch Changes

| Dependency     | Type       | Action  | From  | To    |
| -------------- | ---------- | ------- | ----- | ----- |
| @savvy-web/cli | dependency | updated | 1.4.1 | 1.4.2 |
| @savvy-web/mcp | dependency | updated | 1.6.1 | 1.6.2 |

## 1.3.9

### Bug Fixes

* [`03356b7`](https://github.com/savvy-web/systems/commit/03356b70bb3fa2a89aa0b931d58377ae4f0f0d77) Upgrade transient semver-effect library to correct side effect issues in bundles.
  | Dependency     | Type       | Action  | From  | To    |
  | -------------- | ---------- | ------- | ----- | ----- |
  | @savvy-web/mcp | dependency | updated | 1.6.0 | 1.6.1 |
  | @savvy-web/cli | dependency | updated | 1.4.0 | 1.4.1 |

## 1.3.8

### Patch Changes

| Dependency     | Type       | Action  | From  | To    |
| -------------- | ---------- | ------- | ----- | ----- |
| @savvy-web/mcp | dependency | updated | 1.5.0 | 1.6.0 |
| @savvy-web/cli | dependency | updated | 1.3.6 | 1.4.0 |

## 1.3.7

### Patch Changes

| Dependency     | Type       | Action  | From  | To    |
| -------------- | ---------- | ------- | ----- | ----- |
| @savvy-web/cli | dependency | updated | 1.3.5 | 1.3.6 |
| @savvy-web/mcp | dependency | updated | 1.4.0 | 1.5.0 |

## 1.3.6

### Patch Changes

| Dependency     | Type       | Action  | From  | To    |
| -------------- | ---------- | ------- | ----- | ----- |
| @savvy-web/mcp | dependency | updated | 1.3.5 | 1.4.0 |

## 1.3.5

### Maintenance

* [`8941f4c`](https://github.com/savvy-web/systems/commit/8941f4c8c54f2020d00689269fb16ea05ea94fcb) Coordinated re-release alongside the `@savvy-web/pnpm-plugin-silk` monorepo migration so these packages pick up the refreshed `catalog:silkPeers` peer-dependency ranges. Also adds `LICENSE` files and applies minor manifest and `tsconfig.json` corrections across the three packages in the fixed release group, including moving `@savvy-web/silk-effects` to `devDependencies` in `@savvy-web/silk` (it is build-time only). No runtime behavior changes.
  | Dependency     | Type       | Action  | From  | To    |
  | -------------- | ---------- | ------- | ----- | ----- |
  | @savvy-web/cli | dependency | updated | 1.3.4 | 1.3.5 |
  | @savvy-web/mcp | dependency | updated | 1.3.4 | 1.3.5 |

## 1.3.4

### Patch Changes

| Dependency     | Type       | Action  | From  | To    |
| -------------- | ---------- | ------- | ----- | ----- |
| @savvy-web/mcp | dependency | updated | 1.3.3 | 1.3.4 |
| @savvy-web/cli | dependency | updated | 1.3.3 | 1.3.4 |

## 1.3.3

### Bug Fixes

* [`6a6591c`](https://github.com/savvy-web/systems/commit/6a6591c6385e49ebc8ad60a5a89f66e646c756e6) Updated the shipped Biome asset (`@savvy-web/silk/biome`) to Biome 2.5.1 and broadened the `noUndeclaredDependencies` suppression override.

- `$schema` URL updated to `https://biomejs.dev/schemas/2.5.1/schema.json`
- `noUndeclaredDependencies` is now suppressed for `**/__test__/**`, `**/*.spec.*`, `**/vitest.config.*`, `**/vitest.setup.*`, `**/vitest.env.*`, `**/vitest.globals.*`, and `**/vite.config.*` — previously only `**/*.test.ts` was covered
- the optional `@biomejs/biome` peer dependency range loosened from an exact `2.4.16` pin to `~2.5.0` (the 2.5 minor line)
  | Dependency     | Type       | Action  | From  | To    |
  | -------------- | ---------- | ------- | ----- | ----- |
  | @savvy-web/cli | dependency | updated | 1.3.2 | 1.3.3 |
  | @savvy-web/mcp | dependency | updated | 1.3.2 | 1.3.3 |

## 1.3.2

### Documentation

* [`d7fd974`](https://github.com/savvy-web/systems/commit/d7fd9740ee58347e0c2c92af66edb8289016dd80) The `/silk:tsdoc` skill's guidance on locating `ae-*` and `tsdoc-*` diagnostics has been updated to reflect that `file`/`line`/`column` fields in `issues.json` are now accurate.

- The previous guidance (systems#154) advised locating diagnostics by the symbol name quoted in `text`, because location fields were suppressed as misleading. That guidance is reverted.
- The current guidance: navigate to the `file:line` reported in the diagnostic. Most entries resolve to `src/*.ts` (accurate). The exception is Effect `Data.TaggedError` / service classes whose synthesized `_base` declaration is not source-mapped by rolldown-plugin-dts — those may report a path inside `dist/prod/<id>/declarations/*.d.ts`. In that case, use the symbol name in `text` to find the matching `src/*.ts` declaration.
  | Dependency     | Type       | Action  | From  | To    |
  | -------------- | ---------- | ------- | ----- | ----- |
  | @savvy-web/cli | dependency | updated | 1.3.1 | 1.3.2 |
  | @savvy-web/mcp | dependency | updated | 1.3.1 | 1.3.2 |

## 1.3.1

### Documentation

* [`ce970c8`](https://github.com/savvy-web/systems/commit/ce970c8cf390533aab259294c5be38629964ac23) ### `/silk:tsdoc` and `tsdoctor` — sharper authoring guidance

Three clarifications to the `silk:tsdoc` skill and the `tsdoctor` agent, from a large real-world sweep:

* `@packageDocumentation` belongs only in entry-point files — one per `exports` entry, not one per package (a multi-entry package tags each entry module) — never on a non-entry leaf file.
* Every export carrying `@public` or `@internal` needs a one-line summary, not just the release tag. A bare tag that clears `ae-missing-release-tag` but leaves the block empty is only half the fix.
* Barrel files that re-export values or types are flagged as a documentation footgun. Refactoring the export structure is outside the agent's mechanical loop, so the agent now flags a barrel re-export and asks before changing it rather than reshaping exports unilaterally.

### `/silk:tsdoc` — locate diagnostics by symbol name

The `silk:tsdoc` skill now tells you to find an `ae-*` / `tsdoc-*` diagnostic's declaration by the symbol name quoted in the entry's `text`, not by `file`/`line`. Those location fields are no longer emitted for API Extractor diagnostics because the bundled-`.d.ts` analysis reported them against the wrong file. This matches the paired change in `@savvy-web/tsdown-plugins` that drops the misleading location.

| Dependency     | Type       | Action  | From  | To    |
| -------------- | ---------- | ------- | ----- | ----- |
| @savvy-web/cli | dependency | updated | 1.3.0 | 1.3.1 |
| @savvy-web/mcp | dependency | updated | 1.3.0 | 1.3.1 |

## 1.3.0

### Features

* [`81f90f3`](https://github.com/savvy-web/systems/commit/81f90f3e6acc11c0b70be856c676292578fdc7c2) ### `/silk:tsdoc` skill

A new `silk:tsdoc` skill is available in the Silk plugin. It provides toolchain-accurate TSDoc authoring guidance tuned for the `@savvy-web/bundler` API Extractor pass, which fails CI on forgotten exports and undefined tags.

The skill covers:

* A quick-fix map for the common `ae-*` and `tsdoc-*` diagnostic codes (`ae-missing-release-tag`, `ae-forgotten-export`, `ae-incompatible-release-tags`, `ae-unresolved-link`, `tsdoc-undefined-tag`, and others)
* Release-tag policy: when to choose `@public`, `@internal`, `@beta`, or `@alpha`
* How to register a custom TSDoc tag in `savvy.build.ts`
* The complete set of supported standard tags
* Common JSDoc habits that break the TSDoc parser (brace-typed `@param`, missing hyphens, `@class`/`@module`)
* Documentation-depth guidance: structuring `@remarks`, `@example`, and prose for the RSPress API Extractor renderer so generated docs display rich narrative sections rather than bare type signatures

The skill auto-loads when editing `savvy.build.ts` and is user-invokable on demand via `/silk:tsdoc`.

### Dependencies

* | [`a0a96ee`](https://github.com/savvy-web/systems/commit/a0a96ee748297ead67590d8ccbc3eaba4f8f0802) | Dependency    | Type    | Action                | From                  | To |
  | :------------------------------------------------------------------------------------------------ | :------------ | :------ | :-------------------- | :-------------------- | -- |
  | @effect/platform                                                                                  | dependency    | updated | ^0.96.1               | ^0.96.2               |    |
  | effect                                                                                            | dependency    | updated | ^3.21.3               | ^3.21.4               |    |
  | @typescript/native-preview                                                                        | devDependency | updated | ^7.0.0-dev.20260612.1 | ^7.0.0-dev.20260621.1 |    |
  | @types/node                                                                                       | devDependency | updated | ^25.9.0               | ^26.0.0               |    |
  | Dependency                                                                                        | Type          | Action  | From                  | To                    |    |
  | --------------                                                                                    | ----------    | ------- | -----                 | -----                 |    |
  | @savvy-web/mcp                                                                                    | dependency    | updated | 1.2.0                 | 1.3.0                 |    |
  | @savvy-web/cli                                                                                    | dependency    | updated | 1.2.0                 | 1.3.0                 |    |

### `tsdoctor` agent

A new `tsdoctor` agent drives TSDoc diagnostics to zero end-to-end. It builds the target package (prod), reads `dist/prod/issues.json`, applies the `tsdoc` skill's fix recipes for every `ae-*` and `tsdoc-*` diagnostic, and rebuilds to confirm the artifact is clean. The agent does not add `suppressWarnings` entries — suppression is a human escape hatch. Invoke via `/tsdoctor` or by asking Claude to fix TSDoc issues for a package.

### Issues monitor

A new background monitor (`watch-issues`) surfaces `ae-*` and `tsdoc-*` diagnostics from `dist/*/issues.json` as Claude Code notifications during development. The monitor watches for `issues.json` changes written by the build and reports new warnings or errors without requiring a manual log scan.

## 1.2.0

### Patch Changes

| Dependency     | Type       | Action  | From  | To    |
| -------------- | ---------- | ------- | ----- | ----- |
| @savvy-web/mcp | dependency | updated | 1.1.2 | 1.2.0 |
| @savvy-web/cli | dependency | updated | 1.1.2 | 1.2.0 |

## 1.1.2

### Patch Changes

| Dependency     | Type       | Action  | From  | To    |
| -------------- | ---------- | ------- | ----- | ----- |
| @savvy-web/cli | dependency | updated | 1.1.1 | 1.1.2 |
| @savvy-web/mcp | dependency | updated | 1.1.1 | 1.1.2 |

## 1.1.1

### Patch Changes

| Dependency     | Type       | Action  | From  | To    |
| -------------- | ---------- | ------- | ----- | ----- |
| @savvy-web/cli | dependency | updated | 1.1.0 | 1.1.1 |
| @savvy-web/mcp | dependency | updated | 1.1.0 | 1.1.1 |

## 1.1.0

### Features

* [`71e4948`](https://github.com/savvy-web/systems/commit/71e4948f861424345b0bb44844f7acc0b3d31a80) ### `savvy lint init` and `savvy commit init` manage a post-commit hook (#122)

`savvy lint init` and `savvy commit init` now create and manage a `.husky/post-commit` hook that restores the executable bit on shell scripts after each commit. This mirrors the existing post-checkout and post-merge hygiene hooks, closing the gap where a commit could strip the execute permission from the very hooks that `post-checkout`/`post-merge` maintained.

* [`db4bc25`](https://github.com/savvy-web/systems/commit/db4bc2580ac9c42d0174763b3343b10a308657a4) ### Shipped TSConfig presets

`@savvy-web/silk` now ships two ready-to-use TSConfig presets under the `tsconfig/` export namespace, for projects that follow Silk conventions but do not depend on a Silk build tool at the relevant package:

* `@savvy-web/silk/tsconfig/node/root.json` — a monorepo root that runs under Node.js (`module: nodenext`, `target: es2025`, composite/declaration, `types: ["node"]`). Use it where `@savvy-web/bundler` is not a dependency of the root `package.json`.
* `@savvy-web/silk/tsconfig/rspress/website.json` — a standard RSPress site, aligned with RSPress's official website config (`module: esnext`, `moduleResolution: bundler`, `jsx: react-jsx`, `noEmit`, `isolatedModules`, `verbatimModuleSyntax`, `allowImportingTsExtensions`, `noUnusedLocals`/`noUnusedParameters`, `mdx.checkMdx`, `lib: ["dom", "es2023"]`, react/react-dom types), targeting the browser rather than Node.

Reference either from a package's `tsconfig.json` via `"extends": "@savvy-web/silk/tsconfig/node/root.json"`.

### Bug Fixes

* [`71e4948`](https://github.com/savvy-web/systems/commit/71e4948f861424345b0bb44844f7acc0b3d31a80) ### Missing `@effect/*` peers no longer crash the `savvy` CLI or `savvy-mcp` server at load (#126)

`@savvy-web/cli` and `@savvy-web/mcp` now declare `@effect/cluster`, `@effect/rpc`, and `@effect/sql` as direct dependencies. The `@effect/platform-node` root barrel eagerly links these clustering submodules at import time. Without these declarations, a fresh install that did not already provide them indirectly would fail with `ERR_MODULE_NOT_FOUND` before any command could run.

### Build System

* [`db4bc25`](https://github.com/savvy-web/systems/commit/db4bc2580ac9c42d0174763b3343b10a308657a4) The shipped Biome config (`@savvy-web/silk/biome`) now:

- Excludes `.claude/worktrees` from linting, so nested Claude Code worktrees that carry their own root config no longer trigger Biome's nested-root abort and break the pre-commit hook. Every consumer inherits this automatically rather than re-discovering it.
- Broadens the test-fixtures exclusion to `**/__test__/**/fixtures` (any nesting depth).
- Formats shipped TSConfig presets under `**/public/tsconfig/**/*.json` with the standard tsconfig key-sorting rules.

### Changeset push-guard no longer blocks tag and delete pushes (#124)

The `changeset-push-guard` plugin hook no longer triggers on `git push --tags`, `git push --delete`/`-d`, or refspec-deletion pushes (`git push origin :branch`). These push forms cannot introduce unreleased commits, so blocking them on an unreleased-changeset check was a false positive.

### Patch Changes

| Dependency     | Type       | Action  | From  | To    |
| -------------- | ---------- | ------- | ----- | ----- |
| @savvy-web/cli | dependency | updated | 1.0.0 | 1.1.0 |
| @savvy-web/mcp | dependency | updated | 1.0.0 | 1.1.0 |

## 1.0.0

### Patch Changes

| Dependency     | Type       | Action  | From  | To    |
| -------------- | ---------- | ------- | ----- | ----- |
| @savvy-web/mcp | dependency | updated | 0.5.0 | 1.0.0 |
| @savvy-web/cli | dependency | updated | 0.5.0 | 1.0.0 |

## 0.5.0

### Features

* [`111241c`](https://github.com/savvy-web/systems/commit/111241cefd5d91163871c02d2372a2dfae7cac5c) The silk plugin now integrates Biome two ways. A Biome language server (`biome lsp-proxy`, launched through a global-first resolver that falls back to a project-local install) surfaces lint and format diagnostics automatically after edits across JavaScript, TypeScript, JSON, CSS, and GraphQL files. A new `PreToolUse` hook nudges toward the `biome_check` MCP tool whenever Biome is run via Bash — directly or through a package.json script — without ever blocking the command, so Bash stays a valid escape hatch. A `<biome_capability>` SessionStart block documents the division of labor between the LSP (automatic, read-only), the `biome_check` tool (on-demand, structured, can fix), and Bash.

### Patch Changes

| Dependency     | Type       | Action  | From  | To    |
| -------------- | ---------- | ------- | ----- | ----- |
| @savvy-web/mcp | dependency | updated | 0.4.2 | 0.5.0 |
| @savvy-web/cli | dependency | updated | 0.4.2 | 0.5.0 |

## 0.4.2

### Patch Changes

| Dependency     | Type       | Action  | From  | To    |
| -------------- | ---------- | ------- | ----- | ----- |
| @savvy-web/mcp | dependency | updated | 0.4.1 | 0.4.2 |
| @savvy-web/cli | dependency | updated | 0.4.1 | 0.4.2 |

## 0.4.1

### Patch Changes

| Dependency     | Type       | Action  | From  | To    |
| -------------- | ---------- | ------- | ----- | ----- |
| @savvy-web/cli | dependency | updated | 0.4.0 | 0.4.1 |
| @savvy-web/mcp | dependency | updated | 0.4.0 | 0.4.1 |

## 0.4.0

### Bug Fixes

* [`8543348`](https://github.com/savvy-web/systems/commit/85433481b31cfa35ddfe2669dc6217efde327b9e) The `./changesets/markdownlint` entry stays dual-format CJS (markdownlint-cli2 `require()`s it) via a per-entry format override.

### Build System

* [`8543348`](https://github.com/savvy-web/systems/commit/85433481b31cfa35ddfe2669dc6217efde327b9e) Now built with `@savvy-web/bundler`. Versioned in lockstep with `@savvy-web/cli` and `@savvy-web/mcp` (fixed release group).

### Patch Changes

| Dependency     | Type       | Action  | From  | To    |
| -------------- | ---------- | ------- | ----- | ----- |
| @savvy-web/cli | dependency | updated | 0.3.1 | 0.4.0 |
| @savvy-web/mcp | dependency | updated | 0.3.1 | 0.4.0 |

## 0.3.1

### Other

* [`6511053`](https://github.com/savvy-web/systems/commit/651105346f97d6e486106c4a2f992e0b2cbbac0f) Upgrades to pnpm v11 deployments
  | Dependency     | Type       | Action  | From  | To    |
  | -------------- | ---------- | ------- | ----- | ----- |
  | @savvy-web/cli | dependency | updated | 0.3.0 | 0.3.1 |
  | @savvy-web/mcp | dependency | updated | 0.3.0 | 0.3.1 |

## 0.3.0

### Patch Changes

| Dependency     | Type       | Action  | From  | To    |
| -------------- | ---------- | ------- | ----- | ----- |
| @savvy-web/cli | dependency | updated | 0.2.1 | 0.3.0 |
| @savvy-web/mcp | dependency | updated | 0.2.1 | 0.3.0 |

## 0.2.1

### Bug Fixes

* [`29ea5bb`](https://github.com/savvy-web/systems/commit/29ea5bb049ba469e5d44282fd1ae8fbf78b78dba) Fixed a portability error in the config-integration shims. Consumer config files that infer a factory's return type — `export default CommitlintConfig.silk()` from `@savvy-web/silk/commitlint`, or `Preset.silk()` / `Preset.minimal()` / `Preset.standard()` / `Preset.get(...)` from `@savvy-web/silk/lint` — failed to type-check under pnpm with TS2883, because the inferred type's canonical home was `@savvy-web/silk-effects`, a transitive dependency the consumer could not name. The shims now wrap these factories in silk-local facades with silk-owned return types, so consumer declaration emit is portable and no type annotation is needed. The public API is unchanged and consumers require no code changes.
  | Dependency     | Type       | Action  | From  | To    |
  | -------------- | ---------- | ------- | ----- | ----- |
  | @savvy-web/cli | dependency | updated | 0.2.0 | 0.2.1 |
  | @savvy-web/mcp | dependency | updated | 0.2.0 | 0.2.1 |

### Documentation

* [`a9ea047`](https://github.com/savvy-web/systems/commit/a9ea04701507a3d5fb290dbaa1eeb3d5f599a67b) Added package READMEs for `@savvy-web/silk`, `@savvy-web/cli`, and `@savvy-web/mcp`. Each covers installation, quick-start usage, and the package's public surface — the `savvy` commands for the CLI, the drop-in config shim export map for silk, and the tool and resource surface for the MCP server. These READMEs ship with each package and render on its npm page.

## 0.2.0

### Features

* [`38574e2`](https://github.com/savvy-web/systems/commit/38574e29f1e69afde2a52fc7761eda511fa8fabd) ### Single install target for Silk Suite dev tooling

`@savvy-web/silk` is the unified install package for the Silk Suite. It replaces the previous pattern of installing `@savvy-web/changesets`, `@savvy-web/commitlint`, and `@savvy-web/lint-staged` separately. Config-integration shims re-export the relevant `@savvy-web/silk-effects` logic at drop-in entry points compatible with each toolchain's require/import resolution.

Exported entry points:

* `@savvy-web/silk/changesets` — changeset formatter (default export: `{ getReleaseLine, getDependencyReleaseLine }`)
* `@savvy-web/silk/changesets/changelog` — changelog formatter re-export
* `@savvy-web/silk/changesets/markdownlint` — markdownlint custom rules for changeset validation
* `@savvy-web/silk/changesets/remark` — remark plugins for changelog post-processing
* `@savvy-web/silk/commitlint` — commitlint config factory
* `@savvy-web/silk/commitlint/static` — static commitlint config
* `@savvy-web/silk/commitlint/prompt` — commitizen prompt configuration
* `@savvy-web/silk/commitlint/formatter` — custom commitlint output formatter
* `@savvy-web/silk/lint` — lint-staged configuration factory
* `@savvy-web/silk/biome` — Biome preset JSON asset

```typescript
// commitlint.config.ts
export { default } from "@savvy-web/silk/commitlint";

// .markdownlint-cli2.jsonc
{ "customRules": ["@savvy-web/silk/changesets/markdownlint"] }

// .changeset/config.json
{ "changelog": "@savvy-web/silk/changesets/changelog" }
```

### MCP server integration

The bundled `silk@savvy-web-systems` Claude Code plugin now ships an MCP server entry point. A `start-mcp.sh` launcher wires the plugin into Claude Code's MCP layer, and an `mcp-orientation` session-start hook surfaces relevant context at the start of each session.

### Catalog-first MCP orientation and docs-search skill

The bundled silk Claude Code plugin now steers sessions toward the shared savvy MCP corpus more firmly. The SessionStart orientation hook is strengthened so the agent searches `silk://catalog` and the `silk_docs_search` tool before guessing, reading source, or running grep, and reserves shell workspace commands for git state and cases the `workspace_info` tool does not cover.

A new on-demand docs-search skill documents how to query the corpus well: start at `silk://catalog`, search by concept rather than filename, scope by tier, and read ranked results instead of enumerating the whole corpus. The agent loads it when it needs query technique without paying for it in every session's base context.

### Unified SessionStart hooks and a dogfood-feedback prompt

The plugin's SessionStart hooks are consolidated into two — an always-on `orientation.sh` that persists the session environment and emits the combined orientation, and a `startup-only.sh` that runs the per-session `savvy commit` setup and startup orientation. The session environment variables and the push-guard bypass now use the `SILK_` namespace; set `SILK_SKIP_PUSH_CHECK=1` on a `git push` to bypass the changeset push guard.

Because this is an early release, the orientation now asks the agent to note any rough edges it hits — wrong, unhelpful, or confusing results from a skill, hook, the `savvy` CLI, or an agent — and to surface them at the end of a session. With your explicit agreement, the agent can open an issue in `savvy-web/systems`; it will never file one on its own.

### Patch Changes

| Dependency     | Type       | Action  | From  | To    |
| -------------- | ---------- | ------- | ----- | ----- |
| @savvy-web/mcp | dependency | updated | 0.1.0 | 0.2.0 |
| @savvy-web/cli | dependency | updated | 0.1.0 | 0.2.0 |

## 0.1.0

### Features

* [`38574e2`](https://github.com/savvy-web/systems/commit/38574e29f1e69afde2a52fc7761eda511fa8fabd) ### Single install target for Silk Suite dev tooling

`@savvy-web/silk` is the unified install package for the Silk Suite. It replaces the previous pattern of installing `@savvy-web/changesets`, `@savvy-web/commitlint`, and `@savvy-web/lint-staged` separately. Config-integration shims re-export the relevant `@savvy-web/silk-effects` logic at drop-in entry points compatible with each toolchain's require/import resolution.

Exported entry points:

* `@savvy-web/silk/changesets` — changeset formatter (default export: `{ getReleaseLine, getDependencyReleaseLine }`)
* `@savvy-web/silk/changesets/changelog` — changelog formatter re-export
* `@savvy-web/silk/changesets/markdownlint` — markdownlint custom rules for changeset validation
* `@savvy-web/silk/changesets/remark` — remark plugins for changelog post-processing
* `@savvy-web/silk/commitlint` — commitlint config factory
* `@savvy-web/silk/commitlint/static` — static commitlint config
* `@savvy-web/silk/commitlint/prompt` — commitizen prompt configuration
* `@savvy-web/silk/commitlint/formatter` — custom commitlint output formatter
* `@savvy-web/silk/lint` — lint-staged configuration factory
* `@savvy-web/silk/biome` — Biome preset JSON asset

```typescript
// commitlint.config.ts
export { default } from "@savvy-web/silk/commitlint";

// .markdownlint-cli2.jsonc
{ "customRules": ["@savvy-web/silk/changesets/markdownlint"] }

// .changeset/config.json
{ "changelog": "@savvy-web/silk/changesets/changelog" }
```

### MCP server integration

The bundled `silk@savvy-web-systems` Claude Code plugin now ships an MCP server entry point. A `start-mcp.sh` launcher wires the plugin into Claude Code's MCP layer, and an `mcp-orientation` session-start hook surfaces relevant context at the start of each session.

### Catalog-first MCP orientation and docs-search skill

The bundled silk Claude Code plugin now steers sessions toward the shared savvy MCP corpus more firmly. The SessionStart orientation hook is strengthened so the agent searches `silk://catalog` and the `silk_docs_search` tool before guessing, reading source, or running grep, and reserves shell workspace commands for git state and cases the `workspace_info` tool does not cover.

A new on-demand docs-search skill documents how to query the corpus well: start at `silk://catalog`, search by concept rather than filename, scope by tier, and read ranked results instead of enumerating the whole corpus. The agent loads it when it needs query technique without paying for it in every session's base context.

### Unified SessionStart hooks and a dogfood-feedback prompt

The plugin's SessionStart hooks are consolidated into two — an always-on `orientation.sh` that persists the session environment and emits the combined orientation, and a `startup-only.sh` that runs the per-session `savvy commit` setup and startup orientation. The session environment variables and the push-guard bypass now use the `SILK_` namespace; set `SILK_SKIP_PUSH_CHECK=1` on a `git push` to bypass the changeset push guard.

Because this is an early release, the orientation now asks the agent to note any rough edges it hits — wrong, unhelpful, or confusing results from a skill, hook, the `savvy` CLI, or an agent — and to surface them at the end of a session. With your explicit agreement, the agent can open an issue in `savvy-web/systems`; it will never file one on its own.

### Patch Changes

| Dependency     | Type       | Action  | From  | To    |
| -------------- | ---------- | ------- | ----- | ----- |
| @savvy-web/mcp | dependency | updated | 0.0.0 | 0.1.0 |
| @savvy-web/cli | dependency | updated | 0.0.0 | 0.1.0 |
