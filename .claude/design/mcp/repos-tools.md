---
status: current
module: mcp
category: architecture
created: 2026-09-03
updated: 2026-09-03
last-synced: 2026-09-03
completeness: 92
related:
  - ./architecture.md
  - ./tools.md
  - ./changeset-tools.md
  - ./biome-check.md
  - ../silk-effects/architecture.md
  - ../cli/architecture.md
  - ../silk/plugin.md
dependencies:
  - ./architecture.md
  - ./tools.md
  - ../silk-effects/architecture.md
---

# @savvy-web/mcp vendored-repo tools

`repos_inspect` and `repos_manage` — the read-only and mutating halves of the vendored-repo lifecycle over silk-effects' `Repos` namespace — and the `.repos/**` permissions boundary that `repos_manage` enforces.

## Table of contents

- [Overview](#overview)
- [Current state](#current-state)
- [repos_inspect](#repos_inspect)
- [repos_manage](#repos_manage)
- [The permissions boundary](#the-permissions-boundary)
- [Transcript details that carry the lifecycle](#transcript-details-that-carry-the-lifecycle)
- [Rationale](#rationale)
- [Related documentation](#related-documentation)

## Overview

Vendored reference repos live as git submodules under `.repos/`, described by the manifest at `.repos/config.json`. The mechanism — manifest store, submodule plumbing, drift reconciliation and the lockdown that keeps the checkouts read-only — is silk-effects' `Repos` namespace (see [silk-effects/architecture.md](../silk-effects/architecture.md)); the `savvy repos` CLI group and these two tools are its hosts. The plugin-side judgment and guard layer is in [plugin.md](../silk/plugin.md). Both tools follow the conventions in [tools.md](./tools.md) and render every repo-derived string through `src/tools/md-inline.ts`, since vendored-repo content is untrusted input.

## Current state

`repos_inspect` (`src/tools/repos-inspect.ts`) registers `readOnlyHint`; `repos_manage` (`src/tools/repos-manage.ts`) registers `destructiveHint` and is the broadest of the three mutating tools. The runtime provides `Repos.ReposConfigStore`, `Repos.ReposManager` and `Repos.ReposDrift` — one store instance shared by all three — with `Repos.ReposLockdown.layer` supplied to `ReposManager` alone; `ReposDrift` is read-only and deliberately has no lockdown dependency. See `src/runtime.ts`.

## repos_inspect

A discriminated union keyed by `mode`. `status` wraps `ReposManager.status` (per-repo presence, working-tree dirtiness, stale note ids and the index-aware `stagedCommit`/`committedCommit`/`checkedOutCommit` triple); `config` wraps `ReposConfigStore.read` (the validated manifest); `drift` wraps `ReposDrift.check`, the five-authority reconciliation — manifest, `.gitmodules`, worktree, `git submodule status` and the superproject's local git config — plus a one-level probe of each vendored repo's own submodules, returning every disagreement as a typed `RepoDrift`; `gitmodules` decodes the raw `.gitmodules` sections via `@effected/git`'s `Gitmodules`, reading the file through the ambient `FileSystem`/`Path` (which is why the runtime re-exposes those two services).

`gitmodules` is the one mode that does **not** fail on bad input: an unparsable file returns `entries: []` plus a `parseError`, because "the file is broken" is exactly the answer an agent inspecting it needs, and an absent file is likewise empty entries rather than a failure. Only a `NotFound` read is treated as absence; a permission failure or any other read error propagates typed rather than collapsing into an empty report.

## repos_manage

One `action`-discriminated tool covering the whole lifecycle: `sync` (initialize and reconcile submodules per the manifest, apply sparse-checkout, clear stale locks, assert the boundary markers), `pin` (fetch and check out a new ref, staging the gitlink and manifest), `add` (vendor a new repo, validating the ref against the remote first and rolling back a partial vendor), `note` (add, remove or promote an agent note on an entry), `remove` (unvendor — deinit, gitlink, worktree, module gitdir, `.gitmodules` section and manifest entry), `rename` (manifest key and worktree), `restore` (hard-reset one or more repos to their gitlink commit and re-apply sparse paths — **destructive to uncommitted worktree edits**, which the tool description says outright; omitting `names` restores every dirty repo and reports the clean ones as skipped, naming repos restores exactly those) and `deregister` (clear a stale `submodule.<section>` registration from the superproject's local git config — the orphan `localRegistrationDivergence` the drift report names; it refuses a section still backing a live manifest entry and touches local config only, so nothing is staged).

The wire schema is flat — a single `action` enum plus optional fields — because MCP clients render `oneOf` poorly. Internally the handler decodes the flat args into a `Schema.TaggedStruct` request union that names the missing required field per action on decode failure (`action: "pin"` without `ref` fails by naming `ref`; `note` enforces its per-`op` requirements with a filter). The per-action field sets live in the request schemas at the top of the file; the tool description in `src/server.ts` restates them because it is the agent's only instruction.

## The permissions boundary

`sync`/`add`/`pin`/`remove`/`rename`/`restore` are the enforcement point for the vendored-tree permissions boundary: `ReposManager` brackets their git mutations in `Repos.ReposLockdown.withUnlocked` and re-locks the tree (files `0444`, dirs `0555`) afterwards, so `repos_manage` is what makes `.repos/**` read-only at the OS level in the first place. The lock covers the vendored **worktree only** — the submodule's git metadata dir stays writable, since a read-only gitdir breaks `git pull`'s default submodule recursion and any client keeping per-gitdir state — and `sync`/`add` declare the boundary to git instead (`submodule.<path>.update = none`, `fetch.recurseSubmodules = false`, both in the superproject's local config). The silk plugin's Bash/fs/MCP guards are early warning in front of that boundary, not the boundary. Consequences here: `Repos.ReposLockdownError` is in the tool's error union, and `repos_inspect` is unaffected because reading a locked tree needs no write permission.

## Transcript details that carry the lifecycle

Three rendering choices exist to keep a lifecycle sequence honest rather than merely typed:

- `remove`'s transcript echoes `removedEntry.orientation` verbatim as a fenced JSON block, telling the caller to hand it straight back to `add`'s `orientation` parameter. Remove-then-re-add is the standing remedy for several vendored-tree problems, `add` resurrects nothing on its own and no later report can tell the caller what was lost — so it is put in front of them while they still have it.
- `restore`'s "Still dirty — RESTORE DID NOT FULLY SUCCEED" section renders from `stillDirty` **only when non-empty**, unlike the always-rendered sections: a standing `(none)` heading trains a reader to skip past the one section that matters. It points at `repos_inspect mode:"drift"`, since a `nestedSubmoduleDivergence` is the usual cause.
- `pin`, `remove` and `rename` surface a `commitMessage` and a review-and-commit cue, because those actions leave staged changes for the caller to commit; `deregister` says outright that nothing is staged.

## Rationale

### One action-discriminated tool, not per-verb

The `changeset_deps_*` tools split into two because their two calls have different mutation classes. Every `repos_manage` action mutates, and an agent needs to see all available lifecycle operations and pick one per context, so they share a single surface with a single `action` discriminant; later actions extended the enum rather than minting new tools. Splitting them would fragment the discovery burden without changing the safety story.

### The broadest mutating surface, on purpose

Unlike `biome_check` (files only) and `changeset_deps_regen` (confined to `.changeset/`), `repos_manage` stages gitlinks, edits the committed manifest, writes the superproject's local git config and changes filesystem permissions; `remove` deletes a worktree and its module gitdir and `restore` discards uncommitted work by design. That is the point of routing vendored-repo mutation through a tool rather than raw git: the tool is the only path that leaves the tree locked afterwards. Manifest edits and submodule operations are git-reversible; the tool always stages rather than commits so the caller reviews every change.

## Related documentation

- [architecture.md](./architecture.md) — the runtime wiring for the `Repos` services.
- [tools.md](./tools.md) — the conventions these tools follow.
- [silk-effects/architecture.md](../silk-effects/architecture.md) — `ReposManager`, `ReposDrift`, `ReposLockdown` and the drift kinds.
- [cli/architecture.md](../cli/architecture.md) — the sibling `savvy repos` host.
- [silk/plugin.md](../silk/plugin.md) — the plugin guards and skill.
