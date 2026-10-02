---
type: Interface
title: savvy command tree
description: "The savvy binary's command tree, flags, and exit-code contract from the caller's side — what a script or agent invoking savvy may depend on staying stable."
status: draft
kind: cli
resource: ../../packages/cli/src/cli/index.ts
tags: [tooling]
sources:
  - id: cli-architecture
    resource: ../../packages/cli/src/cli/index.ts
  - id: cli-repos-group
    resource: ../../packages/cli/src/commands/repos
  - id: cli-main
    resource: ../../packages/cli/src/main.ts
  - id: cli-bin-e2e
    resource: ../../packages/cli/__test__/e2e/bin.e2e.test.ts
  - id: cli-check
    resource: ../../packages/cli/src/commands/check.ts
  - id: cli-clean
    resource: ../../packages/cli/src/commands/clean.ts
  - id: cli-confirm
    resource: ../../packages/cli/src/internal/confirm.ts
  - id: cli-command-error
    resource: ../../packages/cli/src/internal/command-error.ts
generated:
  by: okfit/claude-code
  at: 2026-10-02T01:43:20Z
  body_sha256: 44a971055dc886e72be7d7cb1cf86baedfa88bd208fa5c1bdfeb00a9d022b709
---

# savvy command tree

## The command tree

```text
savvy init        orchestrator → changeset · commit · lint init in one pass
savvy check       orchestrator → runs all three checks
savvy clean       remove build/cache artifacts across the workspace
savvy commit      hook(session-start · pre-commit-message · post-commit-verify)
                  · lint <file>
savvy changeset   lint · check · transform · validate-file · version
                  · config(validate) · deps(detect · regen)
savvy lint        fmt(package-json · pnpm-workspace · yaml) · text
savvy repos       status · sync · pin · add · note · remove · rename
                  · restore · deregister
```

The tree is static: no runtime discovery, no contribution manifest, no
per-command "is the system configured" gate. `savvy init` and `savvy check`
are the only setup and validation entry points; the three tool groups
(`commit`, `changeset`, `lint`) expose no per-tool `init`/`check`
subcommands of their own.[^cli-architecture]

## Streams, audience, exit codes, and `--version`

- **stdout carries only the result.** A command's human report (`✓` pass,
  `⚠` caveat, `✗` finding, `↷` skipped or not applicable, plus headings,
  indented detail and a closing summary such as `3 ok, 1 warning, 2
  failed`), its JSON documents, and the hook envelopes the `commit hook`
  subcommands emit. A read-only command prints its report as one document;
  a command that writes files prints one per completed step. Every log
  line — progress, diagnostics, and a failure's explanation — goes to
  stderr, as a plain line with no timestamp or level prefix.[^cli-main]
- **The report renders for its audience.** ANSI colour for a person at a
  terminal, plain text for an agent or a pipe, a GitHub Actions log under
  Actions. Colour only tints a glyph or heading, so piped output reads the
  same minus the escapes, and off a terminal no line is wrapped. `NO_COLOR`
  disables colour and `FORCE_COLOR` (which wins over it) forces
  it.[^cli-main][^cli-bin-e2e]
- **Audience flags, on every command.** `--audience <human|agent|ci>`, or
  its shorthands `--human`, `--agent`, `--ci`; more than one is a usage
  error. Without a flag the audience comes from `SAVVY_AUDIENCE`, else
  agent and CI detection from the environment.[^cli-main][^cli-bin-e2e]
- **Diagnostics are opt-in.** `SAVVY_LOG_LEVEL` (or core's `--log-level`)
  turns on a diagnostics sink on stderr — NDJSON for an agent or CI
  audience, a pretty line for a person; unset, it writes
  nothing.[^cli-main]
- **Exit codes:** `0` success; `1` findings (a check failed, a repo is
  dirty, a deletion failed) — reported as output, not as a crash; `64` a
  usage error (unknown flag or subcommand, bad argument, or a prompt-able
  positional left off where no one can be asked), with the error
  and the help on stderr and nothing on stdout, so a caller parsing stdout
  never receives help text. An explicit `--help`, or a command group
  invoked bare, prints its help on stdout and exits `0`. A typed failure is
  one line on stderr; an unexpected defect is an issue report on stderr —
  the kit's failure report with the program's stack, and where to file it.
  `130` means a person backed out of a prompt or confirmation (Esc, `q`,
  Ctrl-C).[^cli-main][^cli-bin-e2e]
- **Prompts appear only for a person at a terminal.** Where a command can
  ask — a picker for a left-off `savvy repos` name, `savvy init`'s
  `--lint-preset`, a destructive confirmation — it does so only when the
  audience is human and stdin/stdout are terminals. An agent, CI, or a pipe
  never sees a screen: a missing positional is a usage error (`64`), an
  omitted `--lint-preset` is `silk`, and a confirmation proceeds as the
  command always has. `--yes`/`-y` answers a confirmation without
  asking.[^cli-confirm]
- **`savvy --version`** prints one line, `savvy v<version>`, for a direct
  install of `@savvy-web/cli`; launched through `@savvy-web/silk`'s bin it
  appends `via @savvy-web/silk <version>`. A typed `savvy` shows that
  suffix only when the package manager gave the `.bin` slot to silk (pnpm,
  Yarn); under npm and bun the cli package's own bin takes the slot and
  prints the bare line.[^cli-main]
- **`savvy check` separates its three sections** (changeset, commit, lint)
  as one document: a collapsible section per tool — a `::group::` under
  GitHub Actions — then a combined summary and, when something `savvy init`
  would fix is not clean, a `run savvy init` tip.[^cli-check]
- **Under GitHub Actions, findings are annotations.** `savvy lint text`
  and `savvy changeset check` emit `::error` workflow commands for each
  finding, so it lands on the file in the PR view.[^cli-architecture]
- **Built-in flags:** `--help`, `--version`, `--completions` and
  `--log-level`. Core's generic `--wizard` is not offered.[^cli-architecture]
- **Typed failures draw a report on stderr.** A command that cannot do
  what it was asked prints a failure line, indented detail, and usually a
  tip saying what to do, and exits `1` — distinct from findings, which
  are stdout output with exit `1`.[^cli-command-error]

## What a caller may depend on

- **`savvy init` and `savvy check` compose the same three tools in the
  same order** (changeset, commit, lint). `check` runs all three without
  short-circuiting and exits `1` on anything a plain `savvy init` would
  fix — a missing or outdated hook section, config or template, in the
  commit and lint checks as well as changesets (before this, the commit and
  lint checks reported such findings but exited `0`); advisory items stay
  exit `0`. `init` stops at a failing commit or lint step, but a changeset
  step failure is reported, sets exit `1`, and the commit and lint steps
  still run. `init --force` asks before overwriting files that exist, at a
  terminal only.[^cli-check]
- **`savvy commit lint <file>` runs the real commitlint preset** over a
  candidate message file — this is the authoritative "would this message
  pass" check, distinct from the advisory heuristics in the pre-commit
  hook.[^cli-architecture]
- **`savvy changeset version` natively applies the pending release** —
  bumping versions, transforming CHANGELOGs, updating `versionFiles` — with
  no `changeset` binary shell-out. `--dry-run` never writes.[^cli-architecture]
- **`savvy changeset version`/`transform` refuse to run against an invalid
  `.changeset/config.json`**; an absent config passes (an un-bootstrapped
  project keeps working). `savvy changeset lint` deliberately skips this
  gate, so it keeps working while a config fix is in progress.[^cli-architecture]
- **`savvy clean` never removes the workspace root directory or its
  `package.json`**, and every match is resolved and rejected unless it
  stays within its own workspace root — a symlink or `..` cannot escape
  containment. `--dry-run`/`-n` previews with no filesystem write;
  `--globs`/`-g` overrides the default pattern set. Failures are collected,
  not thrown: every deletion still runs, and a non-empty failure set ends
  the run as one failure report listing the paths, exit `1`. A person at a
  terminal sees a live progress view; every other run prints the same
  per-workspace documents as before.[^cli-clean]
- **`savvy lint fmt <name>` and lint-staged's direct call format a file
  identically** — both paths call the same underlying formatting handler,
  so there is exactly one behavior to depend on, not two that can drift.[^cli-architecture]
- **`savvy lint text [files…]` is a read-only check, not a formatter.** It
  exits `1` when a file contains a NUL byte or is not valid UTF-8 (either
  makes `grep`/`rg` skip it), reporting `path:line:col` and the byte offset.
  With no arguments it checks every git-tracked source/text file; `--staged`
  reads each file from the git index instead of the working tree, which is
  what the lint-staged handler passes.[^cli-architecture]
- **`savvy lint`/`savvy check` sync every workspace root's
  `biome.json(c)` `$schema` URL**, not just the repository root's; `check`
  reports drift, `lint`/`init` writes it.[^cli-architecture]

## The `savvy repos` group — subcommands and exit-code contract

```text
status [--json] [--drift]      render the manifest state; --drift reconciles it
sync                           reconcile submodules with the manifest: init
                               missing, apply sparse paths, clear locks
pin [name] [ref]               re-pin an entry to a new ref (staged, not
                               committed)
add                            vendor a new repo (staged, not committed)
note add|remove|promote [name] manage the per-entry agent notes; promote folds
                               one into the curated orientation (--into)
remove [name] [--yes]          drop an entry, submodule and worktree
rename [old] [new]             rename an entry and its paths
restore [names...] [--yes]     hard-reset dirty checkouts (destructive)
deregister [section]           clear a stale submodule.<section> local-config
                               registration (the drift report's orphan case)
```

- **`status --drift` runs the plain status report first, then the drift
  reconciliation**; either an unclean status report or any drift sets a
  non-zero exit code. A missing manifest fails at the status call before
  the drift check runs, so the friendly "nothing vendored yet" exit-0 case
  is unaffected by `--drift`. `--json` emits the structured report instead
  of rendered text. Under `--json` a manifest that exists but cannot be
  read or decoded still prints JSON to stdout — `{ "error": "<message>",
  "clean": false }` — and exits `1`, with the message also logged to
  stderr; a missing manifest prints `{ "repos": [], "clean": true }` and
  exits `0`. A consumer parsing `--json` therefore always gets a document,
  never an empty stream; the gitmodules-drift monitor relies on
  this.[^cli-repos-group]
- **`restore` is destructive to uncommitted work by design.** With no
  names it restores every dirty repo and reports the clean ones as
  skipped; with explicit names it validates every name exists before
  restoring any of them, so a typo cannot leave earlier names already
  reset. It can still fail while otherwise succeeding: a `stillDirty` name
  in the result plus a non-zero exit means the reset did not fully clean
  that repo's worktree — never rendered as a plain success.[^cli-repos-group]
- **`remove` prints the removed entry's `orientation` block verbatim as
  JSON** — the standard remedy is remove-then-re-add, and `add` resurrects
  nothing on its own, so this is the caller's only chance to recover a
  hand-curated orientation.[^cli-repos-group]
- **`deregister` touches local git config only and stages nothing** — no
  friendly missing-manifest exit-0 case, and it never opens the vendored
  worktree.[^cli-repos-group]
- **A left-off name is asked for, at a terminal only.** `pin`, `rename`,
  `note` and `remove` show a picker of vendored repos, `deregister` of stale
  registrations, `restore` a multi-select, `note promote` a picker for
  `--into`, and `add` prompts for a missing `--ref`/`--purpose`; help marks
  those positionals "(optional)". Off a terminal the same omission is a
  usage error, exit `64`, and nothing is drawn. `restore` and `remove`
  confirm before acting unless `--yes` is passed or no one can be asked.
  `sync` never prompts. `status --json` output is byte-for-byte unchanged by
  any of this.[^cli-repos-group]
- **Every repos failure is a typed failure report with a hint**, exit `1`
  — never a raw engine error. The exceptions stay outputs: the missing
  manifest's "nothing vendored" line (exit `0`) and `status --json`'s error
  document.[^cli-repos-group]
- **Every mutating op that unlocks the vendored tree
  (`sync`/`add`/`pin`/`remove`/`rename`/`restore`) re-locks it afterward
  even on a caught error** — a caller never observes `.repos/**` left
  writable as a side effect of a `savvy repos` invocation.[^cli-repos-group]

## What a consumer must not assume

- Do not assume a new tool group gets its own `init`/`check` subcommands —
  only `savvy init`/`savvy check` exist at the top level.
- Do not read results from stderr or logs from stdout; since the
  `@effected/cli` adoption (see
  [`decisions/front-ends-adopt-effected-kit.md`](../decisions/front-ends-adopt-effected-kit.md))
  the split is strict.
- Do not parse `savvy repos status`'s human-rendered text; pass `--json`
  for a stable structured shape, or use the equivalent MCP
  `repos_inspect` tool (see [`savvy-mcp-tools`](savvy-mcp-tools.md)).
- Do not expect `savvy repos remove`/`restore` to be non-destructive, or
  `deregister` to stage anything.
- Do not script against the interactive screens; pass every positional and
  `--yes` explicitly, or run with `--agent`/`--ci`, so no prompt can
  appear.

## Related

- [`modules/cli.md`](../modules/cli.md) — the package this command tree
  belongs to.
- [`modules/silk.md`](../modules/silk.md) — the carrier package whose `bin`
  map also puts `savvy` on a consumer's PATH, mirroring this package's own
  bin.
- [`conventions/vendored-repos-handling.md`](../conventions/vendored-repos-handling.md)
  — the routing rule `savvy repos` and `repos_manage` both enforce.

[^cli-architecture]: `../../packages/cli/src/cli/index.ts`
[^cli-repos-group]: `../../packages/cli/src/commands/repos`
[^cli-main]: `../../packages/cli/src/main.ts`
[^cli-bin-e2e]: `../../packages/cli/__test__/e2e/bin.e2e.test.ts`
[^cli-check]: `../../packages/cli/src/commands/check.ts`
[^cli-clean]: `../../packages/cli/src/commands/clean.ts`
[^cli-confirm]: `../../packages/cli/src/internal/confirm.ts`
[^cli-command-error]: `../../packages/cli/src/internal/command-error.ts`
