---
name: repos
description: >
  Vendored reference repos under .repos/ — when to vendor an upstream source as an
  agent authority, sparse-checkout discipline, the re-pin-on-dependency-bump rule,
  the orientation/notes editorial policy, and the repos_inspect/repos_manage MCP
  tools. User-invokable as /silk:repos.
when_to_use: >
  "vendor a repo", "add a reference repo", ".repos directory", "re-pin the vendored
  source", "pin tracks the installed version", "leave a note for the next agent",
  "promote a note to orientation", "what is vendored here", "submodule is dirty",
  "repos_inspect", "repos_manage", "savvy repos"
paths:
  - "**/.repos/config.json"
---

# Vendored reference repos (`.repos/`)

`.repos/` holds git submodules vendored purely so an agent has an authoritative
source to read — never a fork to modify. This skill is the judgment layer: it
covers when vendoring is the right move, how narrow to cut the checkout, when a
pin goes stale, and what belongs in the orientation block versus a note. For the
manifest schema and result shapes, read the entry directly with `repos_inspect`
rather than trusting recall — this file states policy, not the wire format.

## When to vendor

Vendor a repo when it serves as a **read-only authority** an agent consults to
answer questions it can't otherwise answer reliably:

- An upstream library this repo depends on, pinned to the **exact version
  actually installed** (via `catalog:`/`workspace:` resolution) — so an agent
  can read the real source instead of guessing from training-data recall of a
  different version.
- A spec or protocol repo (e.g., a schema or RFC source) that this repo
  implements against.

**If the task requires modifying the vendored code, it does not belong in
`.repos/`.** That's a fork: clone it, work in it as its own checkout, and let it
follow its own lifecycle outside this repo's `.repos/` manifest. A `.repos`
entry is committed as read-only-by-convention (the guards enforce this — see
Mechanics below); an agent that needs to patch vendored code is fighting the
pattern, not using it.

Don't vendor something the agent can already answer correctly from the
package's own type definitions, README, or a well-known stable public API.
Vendoring has a cost — checkout size, pin maintenance, guard surface — so it
should pay for itself by resolving version-specific or otherwise-unanswerable
questions.

## Sparse discipline

Default to the narrowest tree that answers the questions this vendor exists to
answer. `sparse` in the manifest entry is a `git sparse-checkout` path list —
use it.

- Prefer `src` (or the library's actual source directory) over the repo root.
  Docs-generation config, CI workflows, and test fixtures rarely inform an
  agent's understanding of the library's behavior and just add checkout weight
  and noise an agent has to page past.
- Widen deliberately, not defensively. If orientation notes keep pointing
  outside the sparse set (e.g., an agent needed `docs/` to answer a real
  question), that's a signal to add the path — not a reason to vendor the
  whole tree up front "just in case."
- A spec repo where the spec IS the docs tree is the common exception —
  vendor `docs` (or wherever the spec text lives) narrowly rather than the
  whole repo, but don't sparse a spec repo down to nothing over instinct.

## The re-pin rule

**The pin must track the version actually installed.** When a `catalog:`
dependency bump changes which upstream version this repo is running against,
the `.repos` entry for that library is now stale — its `ref` names a version
this repo no longer uses, and answers the agent reads from it may be wrong for
the current code.

**Bump the dependency and re-pin in the same commit.** This is why
`repos_manage action:"pin"` stages the gitlink and manifest change and returns
a ready-made commit message instead of committing on its own: the caller is
expected to fold that staged change into the same commit as the version bump,
not land it separately. A dependency bump PR that doesn't touch the matching
`.repos` pin is incomplete, not merely stale — treat it the same as a
changeset omission would be treated in a package-version PR.

Pinning also surfaces **stale notes**: any note stamped against a ref other
than the new pin is flagged in the pin result (`staleNoteIds`) and in
`repos status`. Review each one before committing — most survive a small
version bump untouched, but treat the flag as a prompt to check, not to
reflexively delete.

## Notes editorial policy

A note is the answer to a **vexing question or a commonly-needed path**,
written against the ref the repo is currently pinned to — not a running log
and not a place to restate what's already obvious from the layout. Concretely:

- **Write a note when** an agent burned real time on a wrong assumption, dug
  through several files to find the actual entry point for some behavior, or
  hit a non-obvious gotcha (a rename, a deprecated-but-still-present API, a
  file that looks like the answer but isn't). The note exists so the *next*
  agent doesn't repeat the dig.
- **Don't write a note for** anything that's stable structure — that belongs
  in `orientation` (`layout`, `keyPaths`, `startHere`), not the note list.
  Notes are for the ephemeral and ref-specific; orientation is for the durable
  and version-independent.
- **Promote when a note survives a re-pin.** If a stale-note review after
  `pin` finds the note's content still holds against the new ref, that's the
  signal it was actually durable structure misfiled as a note — promote it
  (`op:"promote"`, `into: "layout"` or `"startHere"`) instead of just
  re-stamping it. A note that keeps surviving pins and never gets promoted is
  a sign the orientation block is under-filled.
- **The cap is 10 notes per repo, enforced at write time.** Hitting it means
  **consolidate**, not silently fail to add the next one and not delete the
  oldest just to make room. Fold overlapping notes into one, promote whatever
  has proven durable, then add the new note.

The standing expectation: an agent who spends real effort resolving a wrong
assumption about a vendored repo leaves a note so the next agent doesn't pay
the same cost.

## Mechanics pointers

The manifest and result schemas are the source of truth for exact fields —
read them via the tools below rather than hand-editing `.repos/config.json`
from memory (it's read-only by convention; see the guards note).

- **`repos_inspect`** (read-only) — `mode:"status"` for a drift report
  (present/dirty/stale-notes per repo); `mode:"config"` for the full manifest
  brief (purposes, orientation, notes).
- **`repos_manage`** (mutating; every action stages rather than commits) —
  `action:"sync"` self-heals; `action:"pin"` re-pins one repo and returns a
  commit message plus `staleNoteIds`; `action:"add"` vendors a new repo
  (`url`/`ref`/`purpose` required); `action:"note"` with `op:"add"|"remove"|
  "promote"` on a named repo's note list.
- **CLI equivalent** — `savvy repos status|sync|pin|add|note`, same
  semantics; `savvy repos status --json` for machine-readable drift, `savvy
  repos add` requires `--purpose`. Run `savvy repos --help` for the full flag
  reference rather than guessing at option names.
- **`.repos/**` is read-only by guard, not just by convention.** The
  fs/Bash/MCP guards deny direct writes into vendored trees (`config.json`
  itself is exempt, since the tools above write it deliberately). The Bash and
  MCP tripwires are best-effort pattern matches, not a sandbox — they can
  over-deny on an unusual command shape; if a legitimate command gets blocked,
  don't route around the guard with a workaround, use `repos_manage`/`savvy
  repos` instead, which are the sanctioned write paths.
- **`sync` is self-healing.** A dirty submodule, a missing checkout, or a
  stale `git` lock are all things `repos_manage action:"sync"` (or `savvy
  repos sync`) repairs — re-initializing, re-applying sparse paths, and
  clearing stale locks. Reach for `sync` before hand-running `git submodule`
  commands against `.repos/`.

## Known gaps

- **Fresh clones, CI runners, and new worktrees start with empty `.repos/`
  checkouts** — git doesn't populate submodule content on a plain clone.
  Run `savvy repos sync` (or `repos_manage action:"sync"`) once after any of
  these before relying on vendored content being present.
- **GitHub tarball downloads exclude submodule content entirely.** A
  workflow or script that fetches this repo as a tarball (rather than
  `git clone`) will see `.repos/` entries as empty directories with no
  content to sync — vendored content is only ever reachable through an
  actual git checkout with submodules initialized.
