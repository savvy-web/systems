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
generated:
  by: okfit/claude-code
  at: 2026-09-13T01:18:00Z
  body_sha256: ab5cbec1952fe26129064fc0b9520b70c3cba1fdbfb90cc6cdd641fded7e1627
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
  `SAVVY-COMMIT`, `SAVVY-LINT`. A lowercase key does not error — it
  reports `Absent` and a sync appends a second, silently duplicate,
  block beside the first. Any new Silk section identity must go through
  the same uppercasing guard rather than passing a raw tool name
  through.[^savvy-sections]
- A composed tool section (`savvyToolSection(toolName, command)`)
  requires a `savvy-base` section earlier in the same file, because its
  one-line body (`in_ci || pm_exec <command>`) depends on the preamble's
  `ROOT`, `in_ci`, `PM`, and `pm_exec` definitions. `command` is
  forwarded verbatim — no parsing, quoting, or interpolation — so shell
  tokens like `$ROOT` and `$1` survive into the literal section
  body.[^hook-sections-doc]
- Two sections are deliberately self-contained rather than composed on
  `savvy-base`, because their homes (`post-checkout`, `post-merge`)
  carry `SAVVY-HOOKS` but not `SAVVY-BASE`: the toolchain-drift check
  (`savvyToolchainCheck`, warns only, never blocks, installs nothing) and
  the dependency auto-install (`SAVVY-INSTALL`, runs the detected
  package manager's install after a checkout or merge that changed
  dependencies). Neither ships in `post-commit`, which fires on every
  commit and is noisier than either event warrants.[^hook-sections-doc]
- The auto-install section is neutralized to a silent no-op under any of:
  running in CI (the runtime action owns installation there), the
  `SAVVY_SKIP_INSTALL` escape hatch, a `post-checkout` invocation whose
  branch flag is `0` (a single-file checkout, not a move between
  commits), or no relevant diff across manifests and lockfiles — except
  that a missing `node_modules` always overrides the diff gate. It skips
  lifecycle scripts by default; running them is an explicit,
  locally-scoped opt-in (`git config --local
  savvy.installLifecycleScripts true`) that this module only ever
  reports the need for, never sets on a consumer's behalf.[^hook-sections-doc]

## Related

- [modules/silk-effects.md](../modules/silk-effects.md) — the module
  whose `init`/`check` CLI commands drive these sections.
- [modules/silk-plugin.md](../modules/silk-plugin.md) — the plugin whose
  hook shell test suite exercises the rendered files.

[^hook-sections-doc]: `../../packages/silk-core/src/schemas/SavvySections.ts`
[^savvy-sections]: ../../packages/silk-core/src/schemas/SavvySections.ts
