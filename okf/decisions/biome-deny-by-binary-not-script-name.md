---
type: Decision
title: Deny Biome by whether the command reaches the binary, not by script name
description: "biome-direct-deny denies a command only when it syntactically reduces to the Biome binary itself; it never inspects or denies a package-manager script by name, since a script always resolves package.json (and therefore the repo's Biome config) before anything runs."
status: draft
tags: [tooling, security]
generated:
  by: okfit/claude-code
  at: 2026-09-13T01:18:00Z
  body_sha256: 5a134526d5e37a3fd633973dd69921cf0002df2d3ab01c4287cb8e3c26046bd2
sources:
  - id: biome-direct-deny
    resource: ../../plugins/silk/hooks/pre-tool-use/biome-direct-deny.sh
  - id: biome-direct-deny-bats
    resource: ../../plugins/silk/tests/pre-tool-use-biome-direct-deny.bats
---

# Deny Biome by whether the command reaches the binary, not by script name

## Context

`biome-direct-deny` is a `PreToolUse` hook on `Bash` that exists to stop a
direct Biome invocation from walking, unconfigured, into `.repos/**`
read-only vendored submodules and corrupting them or dying on `EACCES`: a
direct invocation skips the repo's Biome config (root `biome.jsonc`
extending `packages/silk/public/biome/silk.jsonc`, which excludes
`.repos` and `.claude/worktrees`), while a package-manager script
invocation always resolves `package.json` — and therefore the repo's
config — before anything runs.[^biome-direct-deny] The hook needed a rule
for telling those two cases apart from a Bash command string alone.

## Decision

Deny exactly the commands that reduce, after peeling `env`/`VAR=value`/
`sudo`/`command`/`time`/`exec`/`npx`/`bunx`/`bun x`/`pnpm|yarn dlx`/
`pnpm|npm|yarn|bun[ run]` prefixes, to the Biome binary itself — bare,
path-prefixed, or the scoped `@biomejs/biome` package name — and leave
every package-manager script invocation alone regardless of its name,
decoration (`--filter`, `-r`), or whether it is a `turbo run <task>`.
There is no separate check on script names at all: peeling stops at the
script or task name, never at whatever that script's body goes on to
invoke, so a script is structurally never mistaken for a direct Biome
invocation.[^biome-direct-deny] The hook's own bats suite pins this as a
regression guard: `pnpm lint:fixme`, `pnpm lint:evil`, and `pnpm lintfoo`
are all asserted allowed specifically because a look-alike script name
must never be treated as evidence of anything.[^biome-direct-deny-bats]

The hook's committed header comment states that an earlier version on the
same branch also denied any package-manager script other than the three
sanctioned names ("`pnpm lint`", "`pnpm lint:fix`", "`pnpm
lint:fix:unsafe`") as an "accepted consequence," and that probing it
showed the rule was backwards against the actual hazard: it blocked
decorated forms of the sanctioned names (e.g. `pnpm --filter
@savvy-web/cli lint`) while letting every other script name through
unexamined, since `pnpm lint:custom` could invoke Biome however it liked
and was never even considered.[^biome-direct-deny] The bats file repeats
the same account in its own header and in the block of tests asserting
`pnpm --filter @savvy-web/cli lint`, `pnpm -r lint`, and `turbo run lint`
are all allowed.[^biome-direct-deny-bats] Because this repository squash-
merges, the intermediate script-name-denying version of the hook itself
is not present as a separate commit in `git log` for this file — the
repository's history shows only the file's creation (already carrying
this account in its header) and one later hardening commit that added the
consumer-false-positive note. The claim that the stricter rule was tried
and reverted is confirmed by what the hook and its test file say about
themselves, not by a recoverable prior diff.

## Alternatives rejected

- **Deny any script whose name is not one of the three sanctioned
  names.** Tried and reverted per the hook's own account (above): it
  produces false denies on legitimate decorated invocations of a
  sanctioned script while giving no coverage at all against an
  unsanctioned script name that itself runs Biome directly, since the
  hook has no visibility into what a script's body invokes.[^biome-direct-deny]
- **Resolve `package.json` scripts (and, for `turbo run`, the workspace
  task graph) to see what a script's body actually invokes.** Rejected as
  out of scope for this hook: that is real script/task-graph resolution
  machinery the hook does not have, and approximating it risks the same
  false-deny failure mode the reverted version already
  demonstrated.[^biome-direct-deny]
- **Treat a missed case as acceptable the way `biome-prefer-mcp`
  does.** Rejected for this hook specifically: `biome-direct-deny` is a
  deny, not a nudge, because the hazard is corruption, not style; it
  stays a separate hook from `biome-prefer-mcp` (additive-only,
  `additionalContext`, never blocks) for exactly this reason.[^biome-direct-deny]

## Consequences

- Any Bash command that reduces to the Biome binary — bare, path-
  prefixed, via `exec`/`npx`/`bunx`/`dlx`/`pnpm exec`, `sudo`/`env`-
  wrapped, or the scoped `@biomejs/biome` package name — is denied,
  including forms that would resolve *real* Biome.[^biome-direct-deny]
- Any package-manager script invocation is allowed through this hook
  regardless of its name: an unsanctioned or even suspicious-looking
  script name (`lint:custom`, `lintfoo`) is not examined and is not this
  hook's problem to catch.[^biome-direct-deny]
- A future change to this hook must not reintroduce a script-name
  heuristic; the bats suite pins several look-alike script names as
  regression guards specifically to catch that regression.[^biome-direct-deny-bats]
- See [conventions/biome-invocation.md](../conventions/biome-invocation.md)
  for the imperative rule this decision backs, and
  [modules/silk-plugin.md](../modules/silk-plugin.md) for where the hook
  sits in the plugin's overall Biome capability.

[^biome-direct-deny]: `plugins/silk/hooks/pre-tool-use/biome-direct-deny.sh`
[^biome-direct-deny-bats]: `plugins/silk/tests/pre-tool-use-biome-direct-deny.bats`
