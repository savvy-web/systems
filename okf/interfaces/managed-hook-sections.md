---
type: Interface
title: Managed hook sections
description: "The BEGIN/END MANAGED SECTION marker contract that lets multiple Silk tools own adjacent blocks inside one shared husky hook file without clobbering each other or user content."
status: draft
kind: api
resource: ../../packages/silk-core/src/schemas/SavvySections.ts
tags: [tooling]
sources:
  - id: hook-sections-doc
    resource: ../../packages/silk-core/src/schemas/SavvySections.ts
  - id: savvy-sections
    resource: ../../packages/silk-core/src/schemas/SavvySections.ts
  - id: savvy-install-section
    resource: ../../packages/silk-core/src/schemas/SavvyInstallSection.ts
  - id: savvy-okf-section
    resource: ../../packages/silk-core/src/schemas/SavvyOkfSection.ts
generated:
  by: okfit/claude-code
  at: 2026-09-16T23:14:45Z
  body_sha256: aa1ef3e52bb3e9862cc965f3eb87921fdf86e71120746db62cb374938fa955f2
---

# Managed hook sections

## What stays stable

A consumer that syncs a husky hook file through `@effected/templates`'
`ManagedSection` engine (via the `SectionId`/`Section` identities this
module defines) gets these guarantees, not the mechanics behind
them:[^hook-sections-doc]

- Every listed section ends up present in the hook file in declared
  relative order; user content written before, after, or between managed
  sections is preserved untouched; unrelated tool sections already in the
  file are left alone; and repeated syncs are idempotent — running twice
  produces the same file as running once.[^hook-sections-doc]
- The wire format is fixed and MUST NOT be hand-authored to differ from
  it:

  ```text
  # --- BEGIN {KEY} MANAGED SECTION ---
  managed content here
  # --- END {KEY} MANAGED SECTION ---
  ```

  `check` reports one of `UpToDate` / `Drifted` / `Absent` for a given
  section; `read` returns the current content as an `Option`.[^hook-sections-doc]
- **Section keys are uppercased at construction, and that is
  load-bearing, not stylistic.** The engine renders whatever key it is
  given verbatim into the markers, while the markers already committed
  into every consumer repo's hook files are `SAVVY-BASE`, `SAVVY-HOOKS`,
  `SAVVY-COMMIT`, `SAVVY-LINT`, `SAVVY-OKF`. A lowercase key does not
  error — it reports `Absent` and a sync appends a second, silently
  duplicate, block beside the first. Any new Silk section identity must
  go through the same uppercasing guard rather than passing a raw tool
  name through.[^savvy-sections]

## Three section shapes

Every Silk section is one of three shapes, and the shape decides whether
it may lean on the `SAVVY-BASE` preamble (`ROOT`, `in_ci`, `PM`,
`pm_exec`):

- **Composed one-liner** (`savvyToolSection(toolName, command)`): requires
  a `savvy-base` section earlier in the same file, because its one-line
  body (`in_ci || pm_exec <command>`) depends on the preamble's `ROOT`,
  `in_ci`, `PM`, and `pm_exec` definitions. `command` is forwarded
  verbatim — no parsing, quoting, or interpolation — so shell tokens like
  `$ROOT` and `$1` survive into the literal section
  body.[^hook-sections-doc]
- **Self-contained block**: two sections are deliberately self-contained
  rather than composed on `savvy-base`, because their homes
  (`post-checkout`, `post-merge`) carry `SAVVY-HOOKS` but not
  `SAVVY-BASE`: the toolchain-drift check (`savvyToolchainCheck`, warns
  only, never blocks, installs nothing) and the dependency auto-install
  (`SAVVY-INSTALL`, runs the detected package manager's install after a
  checkout or merge that changed dependencies). Neither ships in
  `post-commit`, which fires on every commit and is noisier than either
  event warrants.[^hook-sections-doc]
- **Preamble-dependent multi-line block**: one section, `SAVVY-OKF`
  (`SavvyOkfSection` / `savvyOkfSync()` / `savvyOkfBlock()` in silk-core,
  re-exported by silk-effects), reads `ROOT`, `in_ci` and `pm_exec` from
  the preamble like a composed section but is a hand-written multi-line
  body built with `SavvyOkfSection.section(...)`, because it needs its
  own guards rather than the `in_ci || pm_exec` one-liner. The
  dependency is safe only because its sole home is `pre-commit`, which
  always carries `SAVVY-BASE`; `savvy lint init` writes it after
  `SAVVY-LINT` and `savvy lint check` reports on it.[^savvy-okf-section]

## The SAVVY-OKF section

The block runs `okfit sync --staged` over the repo's `okf/` bundle so the
`generated.at` stamp on every staged concept lands in the same commit as
the edit that moved it, instead of surfacing as drift on the next
validate.[^savvy-okf-section]

- It is a silent no-op in CI, when the repo has no `okf/` directory, or
  when `$ROOT/node_modules/.bin/okfit` is not executable. The probe is
  the local bin rather than `command -v okfit` because the tool runs
  through `pm_exec`, which resolves the LOCAL devDependency and never a
  global install — a global-only `okfit` would pass `command -v` and
  then fail under `pm_exec`. `node_modules/.bin` is common to all four
  supported package managers, so one probe covers
  them.[^savvy-okf-section]
- Once it runs, a non-zero `okfit sync` exit FAILS the commit: a bundle
  the tool cannot sync is a broken bundle. `--staged` re-adds whatever it
  writes, so the hook needs no `git add` of its
  own.[^savvy-okf-section]
- The positional argument is `"$ROOT"`, the PROJECT root `okfit` starts
  config discovery from — not the bundle directory. Passing `"$ROOT/okf"`
  makes the tool look for the bundle at `okf/okf` and exit
  3.[^savvy-okf-section]
- The default `--staged` modes are `generated` and `index`, so the
  derived `index.md` files are re-stamped in the same commit too — but
  only while the bundle is clean apart from what is staged. Index mode
  reads concepts from DISK, not from the git index, and `--staged`
  re-adds what it writes, so an untracked or partially staged concept
  would otherwise let an unrelated commit land an `index.md` entry
  linking a file that commit does not contain. When
  `git status --porcelain -- okf` shows any unstaged or untracked entry,
  the hook narrows to `--only generated` for that commit and the index
  catches up on the next clean one.[^savvy-okf-section]

## The SAVVY-INSTALL section

The auto-install section is neutralized to a silent no-op under any of:
running in CI (the runtime action owns installation there), the
`SAVVY_SKIP_INSTALL` escape hatch, a `post-checkout` invocation whose
branch flag is `0` (a single-file checkout, not a move between
commits), or no relevant diff across manifests and lockfiles — except
that a missing `node_modules` always overrides the diff gate. It skips
lifecycle scripts by default; running them is an explicit,
locally-scoped opt-in (`git config --local
savvy.installLifecycleScripts true`) that this module only ever
reports the need for, never sets on a consumer's
behalf.[^savvy-install-section]

## Related

- [modules/silk-effects.md](../modules/silk-effects.md) — the module
  whose `init`/`check` CLI commands drive these sections.
- [modules/silk-plugin.md](../modules/silk-plugin.md) — the plugin whose
  hook shell test suite exercises the rendered files.

[^hook-sections-doc]: `../../packages/silk-core/src/schemas/SavvySections.ts`
[^savvy-sections]: `../../packages/silk-core/src/schemas/SavvySections.ts`
[^savvy-install-section]: `../../packages/silk-core/src/schemas/SavvyInstallSection.ts`
[^savvy-okf-section]: `../../packages/silk-core/src/schemas/SavvyOkfSection.ts`
