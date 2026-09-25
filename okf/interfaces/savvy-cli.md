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
generated:
  by: okfit/claude-code
  at: 2026-09-25T02:26:25Z
  body_sha256: f70128b3044a82164d70ce6eac9483f287432c9449f436ff36880dfba5285c9d
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
savvy lint        fmt(package-json · pnpm-workspace · yaml)
savvy repos       status · sync · pin · add · note · remove · rename
                  · restore · deregister
```

The tree is static: no runtime discovery, no contribution manifest, no
per-command "is the system configured" gate. `savvy init` and `savvy check`
are the only setup and validation entry points; the three tool groups
(`commit`, `changeset`, `lint`) expose no per-tool `init`/`check`
subcommands of their own.[^cli-architecture]

## Streams, exit codes, and `--version`

- **stdout carries only the result.** A command's human result lines
  (`✓` pass, `⚠` caveat, `✗` finding, `•` skipped or not applicable, plus
  headings, indented detail and a closing summary), its JSON documents, and
  the hook envelopes the `commit hook` subcommands emit. Every log line —
  progress, diagnostics, and a failure's explanation — goes to stderr, with
  no timestamp or level prefix. Colour only tints a glyph or heading, and
  only when stdout is a TTY and `NO_COLOR` is unset, so piped output reads
  the same minus the escapes.[^cli-main]
- **Exit codes:** `0` success; `1` findings (a check failed, a repo is
  dirty, a deletion failed) — reported as output, not as a crash; `64` a
  usage error (unknown flag or subcommand, bad argument), with help on
  stdout and the error on stderr.[^cli-main][^cli-bin-e2e]
- **`savvy --version`** prints one line, `savvy v<version>`, for a direct
  install of `@savvy-web/cli`; launched through `@savvy-web/silk`'s bin it
  appends `via @savvy-web/silk <version>`. The suffix is guaranteed only
  under pnpm — under npm's flat `.bin` the cli package's own bin may be the
  one linked.[^cli-main]
- **`savvy check` separates its three sections** (changeset, commit, lint)
  with a blank line.[^cli-architecture]

## What a caller may depend on

- **`savvy init` and `savvy check` compose the same three underlying checks
  in the same order** (changeset, commit, lint), short-circuiting on first
  failure; a `check` failure names `savvy init` as its remediation.[^cli-architecture]
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
  not thrown: a non-empty failure set is a non-zero exit without aborting
  the remaining deletions.[^cli-architecture]
- **`savvy lint fmt <name>` and lint-staged's direct call format a file
  identically** — both paths call the same underlying formatting handler,
  so there is exactly one behavior to depend on, not two that can drift.[^cli-architecture]
- **`savvy lint`/`savvy check` sync every workspace root's
  `biome.json(c)` `$schema` URL**, not just the repository root's; `check`
  reports drift, `lint`/`init` writes it.[^cli-architecture]

## The `savvy repos` group — subcommands and exit-code contract

```text
status [--json] [--drift]      render the manifest state; --drift reconciles it
sync                           reconcile submodules with the manifest: init
                               missing, apply sparse paths, clear locks
pin                            re-pin an entry to a new ref (staged, not
                               committed)
add                            vendor a new repo (staged, not committed)
note add|remove|promote <name> manage the per-entry agent notes; promote folds
                               one into the curated orientation (--into)
remove <name>                  drop an entry, submodule and worktree
rename <old> <new>              rename an entry and its paths
restore [names...]             hard-reset dirty checkouts (destructive)
deregister <section>           clear a stale submodule.<section> local-config
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
