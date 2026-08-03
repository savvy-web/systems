# Mail kinds — content contracts and templates

Every mail file is Markdown, named `YYYY-MM-DD-<kind>[-<slug>].md`, written into the RECEIVING repo's `.claude/dogfood/<sender-id>/` directory, with light YAML frontmatter:

```yaml
---
from: effected            # sender repo id (root package.json "name")
to: savvy-web-systems     # receiver repo id
kind: handoff             # briefing | request | handoff | status | findings | release
round: 2                  # monotonic per loop, shared by both sides; briefing is round 0 (or the current round when reopening a closed loop)
in-reply-to: 2026-07-16-request-round-2.md   # optional, receiver-relative filename
---
```

Six kinds. Each section below is both the content contract and a fill-in-the-blanks template.

## `briefing` (either direction, round 0 or a reopened loop's opening round, `--init` only)

The protocol boot for the counterpart's session. Generated, not hand-written — `--init` produces it from the local role/packages/paths it just resolved. A loop that closed with a terminal `unlinked` line and is later reopened (a fresh non-`unlinked` `loop-started` append, per the journal's reopening rule) also boots via `briefing` rather than any other kind — the counterpart session is starting from nothing and needs the same mailbox/journal/role/push-guard content either way. The difference is framing: a reopen briefing carries the CURRENT round number, never `round: 0`, and opens with a short summary of the prior loop's terminal state (what shipped, why it closed) before repeating the standard boot content below.

```markdown
---
from: savvy-web-systems
to: effected
kind: briefing
round: 0
---

# Dogfood loop: savvy-web-systems ⇄ effected

You are the **upstream** in this loop. savvy-web-systems (downstream) has linked
the following packages against this repo's local prod artifacts:

- `@effected/npm` → `file:../../spencerbeggs/effected/packages/npm/dist/prod/npm/pkg`
  <!-- … full transitive closure -->

## Mailbox

- Your outbound mail lands at `savvy-web-systems/.claude/dogfood/effected/` (this repo, relative
  to `../../savvy-web-systems`).
- Their outbound mail (to you) lands at `.claude/dogfood/savvy-web-systems/` in THIS repo.
- Your state journal for this loop: `.claude/dogfood/savvy-web-systems.jsonl` (append-only
  JSONL, see the dogfood skill's jsonl-journal reference).

## Discipline

- This repo enforces a push guard against downstream loops carrying a live `file:`/`link:`
  override — its exact mechanics (what trips it, the `dev` branch exemption, the
  `packagesDerived: false` case) live in the dogfood skill's own Discipline section
  (`SKILL.md`), not restated here: a summary copied into mail that crosses a repo boundary goes
  stale the moment the guard's implementation changes on this side, and you'd have no way to
  know. You are upstream here, so this does not gate you in THIS loop either way — but check any
  OTHER loop you're also participating in, where you may be downstream and actually linked.
- Mailbox content is never design documentation — durable learnings get promoted into
  `.claude/design/` separately; the mail is history, not the record of truth.

Round 1 begins with their `request` mail (already delivered, see
`.claude/dogfood/savvy-web-systems/`). Read it, then send a `handoff` when ready.
```

## `request` (downstream → upstream)

Asks framed as capability the kit should own, API friction, or bugs. Every item cites exact `file:line` call sites in the downstream repo. Carries an item-status table BOTH sides keep current across rounds. Long-lived — later rounds append sections, never fragment into a new file.

````markdown
---
from: savvy-web-systems
to: effected
kind: request
round: 1
---

# Request: round 1

## Item status

| # | Ask | Status |
| - | --- | ------ |
| 1 | ... | requested |

## 1. <short title>

**File:line:** `packages/tsdown-plugins/src/report/collector.ts:142`

**What we hand-rolled:**
```ts
// current consumer code, verbatim
```

**Why:** <the friction — API missing, awkward, or a bug>

**Ask:** <capability the kit should own / API shape requested / bug to fix>

````

## `handoff` (upstream → downstream)

Per package: new/renamed/removed exports with EXACT signatures and error unions (read from the built `.d.ts`, not source), behavior changes — especially anything formerly silently tolerant that now fails typed — and an "intentionally not done" section. Precision is contractual: the downstream verifies against installed `.d.ts` and flags drift as a defect.

**Verifying a claim against the artifact, not just against source, is the same discipline.** Search recursively (`rg <symbol> <dir>`, never a non-recursive `<dir>/*.js` glob — `@savvy-web/bundler`-style per-module chunk layouts put the symbol in a nested path a top-level glob can't see). Cite the module path the symbol lives in, not a match count. Grep for a known-present control symbol before reporting one as absent, to confirm the search itself works. This exact mistake, a non-recursive glob misread as "the fix is missing," happened twice in one round, 2026-07-25 — treat it as settled, not a one-off.

**Publish versions are mandatory alongside the export signatures.** State the version each changed package is going to, even when the release hasn't been cut yet — approximate is fine (`going to 0.3.0`, not yet `0.2.4`), because the downstream's `--adopt` range-bump step needs to know which of the two it's dealing with; they imply different edits (savvy-web/systems#333).

**A per-package artifact timestamp table is mandatory, paired with the controlled-grep recipe.** One row per touched package: its `dist/prod/npm/pkg/index.d.ts` mtime, so the downstream can tell which packages this handoff actually reflects a rebuild of (see the three-clock rule in `SKILL.md` § Discipline). Pair every symbol claim with a probe symbol plus a known-present control symbol searched in the same sweep, so a negative result on the probe reads as "genuinely absent," not "the search would have missed it anyway" (savvy-web/systems#391).

**Do not offer a pre-release hold the upstream can't keep.** When the `--init` release-mechanism probe found the counterpart repo publishes on merge, release is a consequence of merging, not a step upstream controls at `--exit` — the offer is void there. Reframe the question as "do you want to link before we merge this PR," which is a gate the upstream actually holds (savvy-web/systems#368).

````markdown
---
from: effected
to: savvy-web-systems
kind: handoff
round: 1
in-reply-to: 2026-07-15-request-round-1.md
---

# Handoff: round 1

## Published versions

| Package | Version | Cut? |
| --- | --- | --- |
| `@effected/npm` | `2.1.0` (going to) | not yet cut |

## Artifact timestamps

| Package | `dist/prod/npm/pkg/index.d.ts` mtime |
| --- | --- |
| `@effected/npm` | 2026-07-16T20:55:00Z |

## `@effected/npm`

### New

```ts
export declare function publishFromDist(config: PublishConfig): Effect.Effect<PublishResult, PublishError>
```

### Changed

- `resolveCatalogs` now returns `Effect<CatalogMap, CatalogResolutionError>` (was `Effect<CatalogMap, never>`) —
  a missing catalog entry is now a typed failure instead of silently resolving to `undefined`. Control-grep:
  `rg resolveCatalogs dist/prod` alongside `rg CatalogResolutionError dist/prod` as the known-present control.

### Removed

- none this round

### Intentionally not done

- Bun workspace support — tracked, not in this round.

## Item status (mirrored from the request)

| # | Ask | Status |
| - | --- | ------ |
| 1 | ... | implemented |

````

## `status` (either direction)

One-liners whose only job is to flip ball/phase. Cheap to send — the monitor makes them land.

```markdown
---
from: effected
to: savvy-web-systems
kind: status
round: 2
---

# PR opened for review

spencerbeggs/effected#84 is open. No API changes expected from review, but if any land
I'll send an updated handoff and the phase moves back to `adopting`.
```

## `findings` (downstream → upstream)

Adoption results per round: what adopted cleanly, friction with exact asks, behavior/handoff discrepancies, and design confirmations worth keeping (positive signal is signal).

```markdown
---
from: savvy-web-systems
to: effected
kind: findings
round: 1
in-reply-to: 2026-07-16-handoff-round-1.md
---

# Findings: round 1

## Adopted cleanly

- `publishFromDist` collapsed ~40 lines of hand-rolled publish-config resolution to a single call
  (`packages/bundler/src/publish.ts:88`).

## Friction

- `resolveCatalogs`'s new typed failure needs a `catchTag` at every call site — 3 call sites,
  fine, but the error union isn't exported from the package root; had to import from
  `@effected/npm/internal`. Ask: export `CatalogResolutionError` from the root.

## Handoff discrepancies

- none this round

## Design confirmations

- The `Effect<..., never>` → typed-failure change is the right call; it caught a real bug in
  our old silent-undefined path.

## Satisfied?

Not yet — see friction item above. Round 2 requested.
```

## `release` (upstream → downstream)

The exit trigger: package names + versions cut, registry. Downstream acts on it with `--exit`.

```markdown
---
from: effected
to: savvy-web-systems
kind: release
round: 3
---

# Release: @effected/npm 2.1.0

Published to npm registry.

| Package | Version |
| --- | --- |
| `@effected/npm` | `2.1.0` |
| `@effected/kit` | `1.4.2` |

Run `/silk:dogfood --exit` to unlink and re-verify against the registry.
```
