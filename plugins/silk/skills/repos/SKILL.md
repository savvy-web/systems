---
name: repos
description: >
  Vendored reference repos under .repos/ — when to vendor an upstream source as an
  agent authority, sparse-checkout discipline, the re-pin-on-dependency-bump rule,
  the orientation/notes editorial policy, and the repos_inspect/repos_manage MCP
  tools. Also covers plain git-submodule vocabulary directed at .repos/ — "manage
  git submodules", "add a submodule", "remove a submodule", ".gitmodules" — since
  this skill, not raw `git submodule`, is the sanctioned path for that vocabulary
  in this repo. User-invokable as /silk:repos.
when_to_use: >
  "vendor a repo", "add a reference repo", ".repos directory", "re-pin the vendored
  source", "pin tracks the installed version", "leave a note for the next agent",
  "promote a note to orientation", "what is vendored here", "submodule is dirty",
  "repos_inspect", "repos_manage", "savvy repos", "rename a submodule", "restore a
  dirty submodule", "drift report"
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

**Verify a pin against the checkout, not against a tag name (#424).** Confirm
what a repo is actually pinned to with `git rev-parse HEAD` run *inside the
vendored checkout* and compare it to the staged gitlink, `git ls-files -s
.repos/<name>` — the two should name the same commit. Don't reach for `git
describe --tags` as the check: in a monorepo upstream (most vendored repos
are), `describe` frequently resolves to the nearest reachable tag, which is
just as often a **sibling package's** release tag as this library's own —
that mismatch is normal monorepo tagging, not drift, and re-pinning against
it would move the pin to the wrong ref.

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
  a sign the orientation block is under-filled. Promote only targets `layout`
  and `startHere` — `orientation.keyPaths` has no tool write path at all, so a
  discovered key path is added by hand-editing the manifest entry's
  `orientation.keyPaths` map directly, note or no note.
- **The cap is 10 notes per repo, enforced at write time.** Hitting it means
  **consolidate**, not silently fail to add the next one and not delete the
  oldest just to make room. Fold overlapping notes into one, promote whatever
  has proven durable, then add the new note.

The standing expectation: an agent who spends real effort resolving a wrong
assumption about a vendored repo leaves a note so the next agent doesn't pay
the same cost.

## Mechanics pointers

The manifest and result schemas are the source of truth for exact fields —
read them via the tools below rather than trusting recall for field names.

- **`repos_inspect`** (read-only) — `mode:"status"` for a per-repo
  present/dirty/stale-notes report; `mode:"config"` for the full manifest
  brief (purposes, orientation, notes); `mode:"drift"` for the four-way
  reconciliation below; `mode:"gitmodules"` for the parsed `.gitmodules`
  entries.
- **`repos_manage`** (mutating) — `action:"sync"` re-materializes missing
  checkouts; `action:"pin"` re-pins one repo, stages the manifest and gitlink,
  and returns a ready-made commit message plus `staleNoteIds`; `action:"add"`
  vendors a new repo (`url`/`ref`/`purpose` required) and stages the result the
  same way as `pin`; `action:"note"` with `op:"add"|"remove"|"promote"` writes
  the manifest directly but does **not** stage it — the note write is an
  ordinary unstaged file edit, like any other, that the caller stages and
  commits themselves; `action:"remove"` unvendors an entry (deinits the
  submodule, drops the worktree and gitdir, rewrites `.gitmodules` and the
  manifest, stages the result) and returns a ready-made commit message plus
  the removed notes for a last look; `action:"rename"` moves an entry to a
  new name (`git mv`, `.gitmodules` section rename, superproject
  `submodule.<name>.*` re-registration, manifest key rename, all staged) and
  returns a ready-made commit message; `action:"restore"` is the dirty-tree
  recovery path — see below.
- **CLI equivalent** — `savvy repos status|sync|pin|add|note|remove|rename|
  restore`, same semantics; `savvy repos status --json` for machine-readable
  status, `savvy repos status --drift [--json]` for the drift report, `savvy
  repos add` requires `--purpose`, `savvy repos rename <old> <new>`, `savvy
  repos restore [name...]`. Run `savvy repos --help` for the full flag
  reference rather than guessing at option names.
- **Drift report (`mode:"drift"` / `--drift`)** reconciles four authorities —
  the manifest, `.gitmodules`, the worktree, and `git submodule status` — and
  is read-only: it never mutates anything, only reports. Each finding names a
  `kind`: `urlMismatch`/`pathMismatch` (a value disagrees between two
  authorities — `manifestValue`/`observedValue` carry both sides),
  `unregisteredManifestEntry` (a manifest entry with no `.gitmodules`
  section), `orphanGitmodulesEntry` (a `.gitmodules` section with no manifest
  entry), `missingWorktree` (no checkout present), `checkoutDiverged` (the
  checked-out commit doesn't match the pinned gitlink), `missingShallow` (the
  `submodule.<path>.shallow` config is absent), and `gitmodulesUnparsable`
  (not about one repo — the file itself failed to parse). `status --drift`
  runs the plain status report first and the drift check after; either
  finding flips the exit code to 1.
- **The `gitmodules-drift` monitor** (`plugins/silk/monitors/`) watches
  `.gitmodules` and `.repos/config.json` for changes and runs `savvy repos
  status --drift --json` on a debounce, printing one line per drift found.
  Filesystem + subprocess only, never mutates anything, and fails open
  (silent) whenever the `savvy` CLI isn't available in the project.
- **The tools are the sanctioned path for submodule mutations; the manifest
  itself is legitimately hand-editable.** The fs/Bash/MCP guards deny direct
  writes into vendored submodule trees, but `config.json` is deliberately
  exempted — the guards' own deny messages point at it as the way to edit
  notes and orientation by hand, and `repos_manage action:"note"` is simply
  the tool-mediated way to make the same edit. Use `pin`/`add`/`sync` for
  anything that touches a submodule's checkout or gitlink; either the tool or
  a direct edit is fine for notes and orientation.
- **The real boundary is OS-level, not pattern-matching.** `sync`/`add`/`pin`/
  `remove`/`rename`/`restore` apply a lockdown: after materializing or updating a submodule, every
  vendored working tree — files `444`, directories `555` — goes
  filesystem-read-only, and the tooling re-locks even when the triggering
  operation itself fails partway through. The metadata directory is locked
  too, derived from the checkout's own `gitdir:` pointer rather than assumed
  from the manifest key — so a submodule registered under a diverging
  `.git/modules` path (e.g. this repo's own `effect` entry, whose gitdir is
  `.git/modules/.repos/effect-smol`) is still covered. `.repos/config.json` is
  never locked (it's host-repo
  content, not vendored), and `repos_inspect mode:"status"`/`savvy repos
  status` work fine against a locked tree — reads don't need write
  permission. A fresh clone's checkouts stay writable until the first `sync`
  locks them. `plugins/silk/hooks/pre-tool-use/repos-bash-guard.sh` is a
  precise early-warning layered in front of that boundary, not the boundary
  itself — read its own header comment for the exact command-scanning it
  applies before denying. If a command shape ever slips past the guard
  anyway, the OS permission still stops the write: an `EACCES` inside
  `.repos/**` means **use the tooling** (`repos_manage`/`savvy repos`), never
  **fix the permissions** — don't `chmod` a vendored tree by hand to work
  around it. That just leaves it writable until the next `sync`/`pin`
  re-locks it out from under you, and it defeats the reason the tree is
  locked in the first place.
- **Two allowances worth stating explicitly, since agents keep tripping over
  them as if they were denials:**
  - Staging the manifest — `git add .repos/config.json`, `git restore
    --staged .repos/config.json` — is sanctioned. The Bash guard's git leg
    clears it whenever every `.repos/`-mentioning token in the invocation
    resolves to exactly `.repos/config.json`; a mixed pathspec that also
    names a vendored path in the same call still denies.
  - Reading or copying content **out of** `.repos/` is sanctioned —
    `cat .repos/effect/src/x.ts`, `cp .repos/effect/src/x.ts
    /tmp/scratch.ts`. Only writes **into** a vendored tree are what the guard
    and the lockdown exist to stop: a redirect target, `cp`/`mv`'s
    destination operand, `tee`'s argument, or any `.repos/` token touched by
    `sed -i`, `rm`, `patch`, or `dd of=`.
- **`sync` re-materializes and re-applies, it does not fix dirtiness.** For
  each manifest entry, `sync` clears stale git locks, re-initializes any
  **absent** submodule checkout, and re-applies each repo's configured sparse
  paths on every run regardless of presence — that's how a manifest sparse
  change propagates to a checkout that already exists. A submodule that is
  **present but dirty** (stray local edits) has its content left untouched by
  `sync` and is reported `upToDate` — though `sync`'s lockdown pass still
  chmods the tree read-only regardless, so "untouched" covers content only,
  not permissions. Dirtiness is surfaced by `repos_inspect mode:"status"`
  (or `savvy repos status`), not fixed by it. **A dirty vendored tree stays
  locked — don't try to clean it up yourself.** `git reset --hard`,
  deleting-and-re-`sync`ing the working directory, or any other hand-run
  recovery write fails against the OS-level `444`/`555` permissions the same
  way any other write into `.repos/**` does. The sanctioned recovery is
  `repos_manage action:"restore"` (or `savvy repos restore [name...]`) —
  explicit only, never run implicitly by `sync` or anything else: it
  hard-resets the named repos (or, with no names, every dirty one) to their
  staged (falling back to committed) gitlink commit and re-applies sparse
  paths, DISCARDING any uncommitted worktree edits and untracked files in the
  repos it touches. Do **not** `chmod` the tree back to writable by hand to
  work around this — that defeats the lockdown and leaves the tree writable
  until the next `sync`/`pin` re-locks it out from under you regardless.
  Reach for `sync` before hand-running `git submodule` commands against
  `.repos/`, and reach for `restore` before hand-cleaning a dirty checkout.

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
- **The shared presets can't reach every place a repo's own config lists
  paths.** Biome, markdownlint, and the shared tsconfig bases exclude
  `.repos/` centrally, but a consuming repo's `pnpm-workspace.yaml` package
  globs, `turbo.json` task `inputs`, and vitest `exclude` lists are
  per-repo config the shared presets don't own — each may need its own
  `.repos` exclusion added by hand in the repo that adopts vendoring.
