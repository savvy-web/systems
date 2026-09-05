---
status: current
module: silk
category: architecture
created: 2026-09-03
updated: 2026-09-05
last-synced: 2026-09-05
completeness: 88
related:
  - ./plugin.md
  - ./plugin-hooks.md
  - ./plugin-it2.md
  - ./plugin-build-tsdoc.md
dependencies: []
---

# plugins/silk — dogfood-mailbox capability

The [silk plugin](./plugin.md)'s **dogfood mailbox protocol**: a repeatable loop for two agent sessions in sibling repo checkouts to request, deliver, adopt and iterate on cross-repo changes before anything is released. Its driver is this repo consuming the `@effected/*` kit from a sibling checkout's local prod artifacts via `pnpm-workspace.yaml` `file:` overrides — the repo-level convention this capability generalizes is recorded in [Repo-level convention](#repo-level-convention) below; the root `CLAUDE.md` keeps only the two rules an agent must check before pushing. Shape: a skill, an enforcement guard and a monitor.

## Table of contents

- [Overview](#overview)
- [Current State](#current-state)
- [The skill and the journal](#the-skill-and-the-journal)
- [The push guard](#the-push-guard)
- [The dogfood-mail monitor](#the-dogfood-mail-monitor)
- [Protocol rules worth knowing before editing](#protocol-rules-worth-knowing-before-editing)
- [Repo-level convention](#repo-level-convention)
- [Rationale](#rationale)

## Overview

The pieces: `skills/dogfood/` (skill, two `references/`, `scripts/journal-append.sh` and `scripts/override-audit.mjs`), `hooks/pre-tool-use/dogfood-guard.sh` and `monitors/dogfood-mail.mjs`. State lives on disk under the gitignored `.claude/dogfood/` in each repo.

## Current State

Implemented; the skill ships to counterpart repos as-is. No loop is currently linked in this repo: `pnpm-workspace.yaml` carries no `@effected` `file:` overrides and every manifest resolves from the registry. `skills/dogfood/SKILL.md` and its `references/` are authoritative for the protocol; the guard header and `tests/pre-tool-use-dogfood-guard.bats` for the deny matrix.

## The skill and the journal

`skills/dogfood/SKILL.md` (`/silk:dogfood --init|--send|--status|--watch|--adopt|--exit`) is the protocol itself; `references/mail-kinds.md` holds the mail kinds and their content contracts and `references/jsonl-journal.md` the journal line shape. It is `paths`-triggered on `.claude/dogfood/**` deliberately: *reading mail is itself the trigger to act on the protocol*, so the receiving agent sees the journal-append instruction before it starts treating the mail's content as the more urgent thing.

State is a per-loop **append-only JSONL journal**, `.claude/dogfood/<counterpart-id>[.<loop-id>].jsonl`, never edited in place: current state is the last valid line, history is the file, corrections are appends and a corrupt tail self-heals because every reader walks back to the last parseable line. The guard and the monitor implement that same walk-back independently — it is the contract all three share. The optional `<loop-id>` suffix is what lets ONE counterpart host two concurrent loops without their state streams colliding; it defaults to the counterpart id, so the bare `<counterpart-id>.jsonl` file every existing loop already writes stays valid and unchanged. Mail lands in the RECEIVING repo at `.claude/dogfood/<sender-id>/` — one mailbox per counterpart, not per loop, so a mail file carries an optional `loop:` frontmatter key routing it to the matching journal; omitting it is the single-loop default. Mailbox and journal are gitignored on both sides. Every append goes through `scripts/journal-append.sh`, which inherits the last valid line, patches only the passed flags and validates the enums. Its `--package`/`--clear-packages` flags record the link closure structurally — they replace the array rather than merge, are downstream-only and refuse a nonempty closure that is not marked `packagesDerived`, because a nonempty list next to `packagesDerived: false` would claim the closure is both known and underived. `scripts/override-audit.mjs` is a warn-only audit for over-derived closures (an override the registry would already satisfy): it cannot tell that case from a deliberate override of a previously published package, so it surfaces the shape and leaves the judgement to the agent.

## The push guard

`hooks/pre-tool-use/dogfood-guard.sh` is registered twice: on `Bash` (`git push`, `gh pr create|edit`) and on the GitKraken/GitHub MCP matcher (`git_push`, `pull_request_create`, `create_pull_request`, `update_pull_request`, `push_files`). The hazard is concrete: a `file:../../` override in `pnpm-workspace.yaml`'s `overrides:` block resolves only on the author's machine, so every other clone and any CI install fails. Three boundaries are load-bearing:

- **The tree decides, not the journal.** It scans only the `overrides:` block (quote-aware comment stripping) for a `file:`/`link:` path escaping the repo and denies when one is present on any branch except `dev`, which is exempt unconditionally (a long-lived integration branch consumed as compiled bundles, so nothing downstream installs against it). With a clean tree the journal is advisory — a non-`unlinked` phase downgrades to a warning — except `packagesDerived: false` on a downstream journal, where the closure is unknown rather than known-clean, which still denies.
- **There is no bypass flag.** A wrong deny is corrected by appending a `correction` snapshot, not by routing around the hook. The guard *can* have no bypass because "a `file:` override is linked" is a mechanical fact readable from the tree, never a judgement call — unlike the changeset case in [plugin-changesets.md](./plugin-changesets.md#no-hook-blocks-on-changesets).
- **Tripwire posture.** Best-effort command matching; fail open on missing `jq`, a malformed envelope, an absent `.claude/dogfood/` or a journal with no valid line — a corrupt journal must never brick every push, and the override-based deny needs no journal at all.

## The dogfood-mail monitor

`monitors/dogfood-mail.mjs` is a sibling of the tsdoc monitor by construction (same poll loop, pure `diagnose`, `--once`). It surfaces two local signals: inbound mail newer than the journal's `lastMail.in`, and a new tail line whose `ball` is `ours`. When that pointer cannot be resolved — a loop that has received nothing yet, or a hand-authored append naming a file that no longer exists — the watermark falls back to the current loop's last `loop-started` timestamp rather than to zero: mail predating this collaboration cannot be new to it, and a zero watermark replays the whole archive as unread. Mailboxes are scanned before journals so a turn-flip can be tested against mail already surfaced on an earlier tick — the local session's own append echoing known mail carries no information and is suppressed, while a genuine inbound turn still fires both lines; the ordering is the whole mechanism.

Multi-loop routing is the monitor's job, because a mailbox is per counterpart while a journal is per loop. `scanJournals()` takes a journal's counterpart from the snapshot's `counterpart.id` when present and falls back to the filename stem, deriving the loop id from the remainder; `diagnose()` then groups journals by counterpart and pins each mail file to one of them by its `loop:` key. The load-bearing case is the mail it CANNOT pin — a counterpart with two or more loops, none named for the counterpart itself, and a file with no `loop:` key, which is every file written before loop-scoped journals existed. Such mail is still attributable to the counterpart, so it is judged against the LOWEST watermark among that counterpart's loops (new if new to at least one) and its notified state is recorded under EVERY candidate journal id, because the turn-flip suppression above looks mail up by `journal.id` and a single mailbox-keyed entry would be invisible to it. The tempting fallback — no single journal, so watermark 0 — is the exact defect the `loop-started` watermark exists to prevent: it makes every archived file newer than the watermark and replays a closed collaboration as unread on the first tick after a second loop opens.

It is **filesystem-only, no network, ever**: the `gh`/`npm view` probes belong to action-time `--status`/`--watch`/`--exit`, where a human asked and they run under the session's own auth.

## Protocol rules worth knowing before editing

- **Mailbox content is never design documentation.** `.claude/design/` is the durable record; mail is history, and a learning worth keeping gets promoted here in a docs pass. The complement: the skill and its `references/` ship to counterpart repos, so their prose stays generic — repo-local issue citations belong in this doc, not the skill.
- **Claims about an artifact are verified by a stated method.** Signatures are read from the built `.d.ts`; presence is checked with a recursive search citing a module path (a per-module chunk layout hides symbols from a top-level glob), with a known-present control symbol grepped before reporting one absent. A probe proves only what its fixture exercises: a documented divergence is a fixture requirement, not a disclaimer.
- **A multi-package cut is released per package, not per workflow.** Packages in one cut land on the registry minutes apart with every workflow already green, so the registry is the only oracle: `--watch` and the upstream `--exit` probe `npm view` once per package before a `release` mail is sent.
- **The safety net and the check are never present at the same time.** While linked, the `file:` override replaces semver resolution outright; at `--exit` the check runs with no net. On a `0.x` kit every meaningful release lands outside every caret range by default, so `--adopt` bumps declared ranges by hand while linked and `--exit`'s registry install is where a stale range finally fails.
- **The opening ball is a fact about the opening mail, not about role.** `--init` takes an explicit `--ball` override for a loop opened from a pre-filed issue before any request mail exists, and the briefing states the same fact in prose.
- **A relay owes its downstream a `status`** when this repo is downstream in one loop and upstream in another over the same change; **a closed loop reopens through `briefing`**, carrying the current round number, rather than a new mail kind.
- **it2 is an optional transport, never authoritative** (doorbell on `--send`, spawn-and-badge on `--init`); the file mailbox is the source of truth and every it2 feature degrades silently when absent. it2's auto-approve plugins are explicitly not adopted — cross-session auto-approval is permission laundering. See [plugin-it2.md](./plugin-it2.md) for the other, unrelated use of the same CLI.

## Repo-level convention

This is the durable pattern for a dogfood round in this repo, not current state. A round consumes the `@effected/*`
kit (`spencerbeggs/effected`, a sibling checkout at `../../spencerbeggs/effected`) from LOCAL prod artifacts, so kit
APIs get shaped against real consumers before release.

- **Authorities.** For `effect` core itself: the vendored source at `.repos/effect` (pinned to the catalog tag). For
  `@effected/*`: the kit source at `../../spencerbeggs/effected/packages/<name>/src` and the installed `.d.ts` under
  `node_modules/@effected/<name>/` — verify signatures there, never from summaries relayed between sessions.
- **pnpm linking.** `pnpm-workspace.yaml` carries an `overrides:` entry per consumed kit package:
  `"@effected/<name>": "file:../../spencerbeggs/effected/packages/<name>/dist/prod/npm/pkg"` (the manifest lives under
  `pkg/`, not `npm/`). Package manifests keep ordinary registry semver ranges — the overrides do the linking, and
  removing them relinks to the registry. Keep the override list covering the FULL transitive `@effected` closure
  (re-derive from the lockfile, not memory). The `overrides:` key also holds unrelated pins (e.g. the api-extractor
  TypeScript override), so "is a round open" is answered by the presence of `@effected` `file:` entries, not the key.
- **Mailbox.** Cross-repo communication lives at `.claude/dogfood/<sending-id>/` in the RECEIVING repo, where
  `<sending-id>` is the SENDER's root `package.json` name — gitignored on both sides, never in design docs. This
  repo's id is `savvy-web-systems`; the kit repo's is `effected`. Outbound requests go to
  `../../spencerbeggs/effected/.claude/dogfood/savvy-web-systems/` (e.g. `systems-dogfood-feedback.md`), and the kit
  session's return handoffs arrive here in `.claude/dogfood/effected/`. Reports carry `file:line` references so the
  other side reads real call sites, and each keeps an item-status table current.
- **The loop.** (1) Migrate a piece here. (2) Gather findings — hand-rolled capability the kit should own, API
  friction, bugs — each with `file:line` references into this repo. (3) Write them as requests into the kit repo's
  mailbox. (4) An agent session in the effected repo implements on a branch there and rebuilds prod artifacts in
  place. (5) On the return handoff, refresh: `pnpm clean --lockfile && pnpm install --ignore-scripts`, then `pnpm
  rebuild esbuild` — `--ignore-scripts` skips native postinstalls, so esbuild's platform binary is missing and
  vite/vitest die without that rebuild. (6) Adopt the new surfaces, run the full gates (`types:check`,
  `build:dev`/`build:prod`, package tests), and feed the next round of findings back into the report.
- **Discipline.** While `file:` overrides are active the branch does NOT push or open PRs — the paths only exist on
  this machine, and the loop isn't done until the kit provides what we need ([the push guard](#the-push-guard)
  enforces this mechanically). The exit is: effected cuts a live release, the `@effected` overrides are deleted
  (unlink), `pnpm clean --lockfile && pnpm install` against the registry, full verification, and only then the
  finalize workflow (docs, changesets, squash, PR).

## Rationale

A file mailbox plus an append-only journal is the simplest thing two independent agent sessions can share without a network, a service or a shared repo, and it leaves an audit trail by construction. The guard reads the tree rather than the journal because only the tree is a mechanical fact — which is also what lets it be the plugin's one deny with no bypass. The monitor stays offline so the protocol never reaches the network on a schedule nobody asked for.
