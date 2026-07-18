---
name: dogfood
description: >
  The dogfood mailbox protocol: a repeatable loop for two agent sessions in
  sibling repo checkouts to request, deliver, adopt, and iterate on
  cross-repo changes (e.g. a pnpm `overrides:` link against a sibling
  checkout's local prod artifacts) before anything is released. Mail files
  plus a per-loop JSONL state journal under .claude/dogfood/, a phase/ball
  machine, an enforced no-push-while-linked rule, and an optional it2
  transport layer. /silk:dogfood --init|--send|--status|--watch|--adopt|
  --exit. Auto-loads whenever files under .claude/dogfood/** are read or
  written -- reading mail is itself the trigger to act on the protocol.
when_to_use: >
  "start a dogfood loop", "link this package via override", "dogfood
  effected/systems", "send a request/handoff/status/findings/release mail",
  "what's the state of the dogfood loop", "whose ball is it", "is it my
  turn", "watch for the upstream release", "adopt the handoff", "exit the
  dogfood loop", "unlink the file: override", "reading mail under
  .claude/dogfood", ".claude/dogfood directory", "cross-repo collaboration
  loop", "kit dogfooding"
argument-hint: "--init | --send <kind> | --status | --watch | --adopt | --exit"
paths:
  - "**/.claude/dogfood/**"
---

# Dogfood mailbox (`/silk:dogfood`)

The user invoked `/silk:dogfood` with arguments: `$ARGUMENTS` — or a file under `.claude/dogfood/**` was just read or written, which is itself the trigger to apply this skill (see Inbound processing below). Bare invocation, or no recognized flag, means `--status` plus a recommended next action.

A **loop** is one collaboration: an (upstream, downstream, linked-package-set) triple between this repo and one sibling checkout. The **downstream** requests changes and consumes artifacts; the **upstream** implements and provides them. Roles are per-loop, not repo-global — a repo can be downstream in one loop and upstream in another simultaneously. The **repo id** is the counterpart's root `package.json` `name`, used as both the mailbox directory key and the journal filename. The **ball** says whose move it is; every mail kind deterministically flips or keeps it.

Full design rationale, resolved questions, and explicit v1 scope cuts: `docs/superpowers/specs/2026-07-16-dogfood-mailbox-skill-design.md`.

## Mailbox: location and file format

Mail lands in the RECEIVING repo at `.claude/dogfood/<sender-id>/`. Both repos gitignore `.claude/dogfood` (`--init` adds the entry to both `.gitignore`s if missing). Markdown files, named `YYYY-MM-DD-<kind>[-<slug>].md`, with light YAML frontmatter (`from`, `to`, `kind`, `round`, optional `in-reply-to`). Full templates and content contracts for all six kinds: `references/mail-kinds.md` — load when composing a `--send <kind>` mail or reading one you need to verify against its contract.

| Kind | Direction | One-line contract |
| --- | --- | --- |
| `briefing` | either, round 0, `--init` only | Generated protocol boot for the counterpart's session. |
| `request` | downstream → upstream | Asks with exact `file:line` cites; long-lived item-status table both sides keep current. |
| `handoff` | upstream → downstream | Exact export signatures/error unions from built `.d.ts`, behavior changes, "intentionally not done" section. |
| `status` | either | Cheap one-liner that only flips ball/phase. |
| `findings` | downstream → upstream | Adoption results: clean, friction, discrepancies, confirmations. |
| `release` | upstream → downstream | The exit trigger — package names, versions, registry. |

## Inbound processing

Receiving is not a separate mode. The receiving agent appends the corresponding journal snapshot (updated `phase`/`ball`/`lastMail.in`, `event: "mail-received"`) as the FIRST step of acting on any mail — before drafting a response, before starting the work the mail asks for. This skill auto-loads whenever a file under `.claude/dogfood/**` is read or written, so reading mail is itself the trigger that puts this instruction in front of you. Don't skip the journal append because the mail's content feels like the more urgent thing to act on.

## The state journal

One JSONL file per loop, per repo: `.claude/dogfood/<counterpart-id>.jsonl`, gitignored, hand-appended, **never edited in place**. Each line is a complete snapshot: current state = the last valid line (no fold/reduce anywhere), history = the file, corrections are appends (`event: "correction"`), corrupt tails self-heal (a malformed last line is skipped, readers walk back). A new collaboration with the same counterpart continues the same journal after a terminal `unlinked` line — no archival step. Full snapshot-line shape (every field, upstream-vs-downstream differences, an append recipe): `references/jsonl-journal.md` — load before your first append in a session, or whenever you need the exact field set.

## Phase machine

```text
requested → implementing → handoff → adopting → findings ─┐
    ▲                                                     │ (iterate: next round)
    └─────────────────────────────────────────────────────┘
findings (downstream satisfied) → upstream-pr → released → unlinked  (terminal)
```

| Phase | Ball | Meaning |
| --- | --- | --- |
| `requested` | upstream | Request mail sent; upstream to implement. |
| `implementing` | upstream | Upstream working; optional `status` mail on milestones. |
| `handoff` | downstream | Handoff mail landed; downstream to refresh + adopt. |
| `adopting` | downstream | Downstream migrating onto new surfaces and verifying. |
| `findings` | upstream | Findings sent. Iterates (→ `implementing`, `round + 1`) or, when downstream is satisfied, advances. |
| `upstream-pr` | upstream | Upstream's branch is in GitHub review. Review MAY change APIs — if so, upstream sends `status`/`handoff` and phase legally moves BACKWARD to `adopting`. |
| `released` | downstream | Release landed (mail OR probe-verified); downstream runs `--exit`. |
| `unlinked` | — | Terminal. Overrides removed, registry install verified. |

## `--init`: start a loop

Interactive-lite. Gather: counterpart path, this repo's role, packages to link.

1. Confirm `.claude/dogfood` is in this repo's `.gitignore`; add it if missing. Same check in the counterpart's `.gitignore` if you have write access to that checkout (you usually do — it's a sibling path).
2. Create the mailbox directories in both repos: `.claude/dogfood/<other-id>/` here, `<counterpart-path>/.claude/dogfood/<this-id>/` there.
3. **Downstream only:** derive the FULL transitive closure of linked `@scope/*` packages from the counterpart's lockfile (never from memory), and add one `pnpm-workspace.yaml` `overrides:` entry per package: `"@scope/name": "file:<counterpart-path>/packages/<name>/dist/prod/npm/pkg"` (the manifest lives under `pkg/`, confirm the counterpart's actual build-output layout rather than assuming). Run the refresh recipe (`pnpm clean --lockfile && pnpm install --ignore-scripts`), confirm link resolution (`node -e "require.resolve('@scope/name')"` or equivalent), and record `nativeRebuilds` by scanning the resolved dependency tree for known native deps whose install scripts `--ignore-scripts` will skip (e.g. `better-sqlite3`).
4. **Counterpart launch probe**, before generating anything meant to open a session there: read the counterpart's root `package.json`. Its `devEngines` field says which package manager runs there — do not assume your own. If its `scripts` block has a `claude` script, that script is the launch path (`<pm> run claude`), not raw `claude` — repos that bootstrap sessions (selective plugin enablement, env setup) only work through their own script, and raw `claude` silently skips it. Raw `claude` is the fallback only when no such script exists.
5. Append the opening `loop-started` journal line in BOTH repos — this is the one deliberate cross-repo write in the whole protocol (every other append is same-repo). `role`/`packages`/`nativeRebuilds`/`linkType` differ per side per the jsonl-journal reference's upstream-side note.
6. Generate the counterpart briefing (template: `references/mail-kinds.md` § `briefing`) and write it to the counterpart's mailbox as round-0 mail.
7. **When it2 is available** (see below): spawn the counterpart session directly, cd'd into its checkout, with the generated briefing as the opening prompt, and badge both panes by role. Otherwise, tell the user the briefing is ready at `<path>` to hand-carry.

## `--send <kind>`

1. Compose the mail from the matching content contract in `references/mail-kinds.md`. `request` and `findings` append to the loop's existing long-lived document when one exists for this round-sequence rather than fragmenting into a new file — only start a fresh file when the kind or the round genuinely warrants it (a `handoff` is always its own file per round; a `request`'s item-status table persists and grows).
2. Write it into the counterpart's mailbox: `<counterpart-path>/.claude/dogfood/<this-id>/YYYY-MM-DD-<kind>[-slug].md`.
3. Append the updated journal snapshot in THIS repo's own journal (`round`/`ball`/`phase`/`lastMail.out`, `event: "mail-sent"`) per the phase machine above — sending a `request` moves `ball` to `theirs` and `phase` to `requested`; sending a `handoff` moves `ball` to `theirs` and `phase` to `handoff`; etc. Get the direction right by checking the phase table's `Ball` column against the phase this mail causes.
4. Ring the it2 doorbell (below) when available.

## `--status`

Render the last journal line per loop: role, phase, whose ball, and any unread inbound mail (files in `.claude/dogfood/<id>/` newer than that journal's `lastMail.in` — the monitor surfaces this passively; `--status` computes it fresh on demand). Report the recommended next action from the phase table.

For a loop in `upstream-pr` or `released`, augment with the action-time GitHub/registry probes (read-only, using the session's existing `gh` auth — never a stored token): `gh pr view` for review state/checks/merged, `gh run list` for silk-release-action progress, `npm view <pkg> version` for whether the release actually landed. These probes run only when `--status` (or `--watch`/`--exit`) is invoked — never from the background monitor, which stays filesystem-only.

## `--watch`

An explicitly human-requested polling loop (the `/loop` pattern: self-paced interval, e.g. 5–15 minutes) over the same probes as `--status`, for "tell me when the effected release lands." This is the one sanctioned exception to no-polling in this skill, because a human asked for it and it has a terminal condition: end the loop the moment the probe goal is reached (PR merged / version visible on the registry), and surface the recommended next action (`--adopt` or `--exit`). Do not poll indefinitely or poll without having been asked.

## `--adopt`

The downstream receive flow, run after a `handoff` lands:

1. Re-read the newest handoff mail.
2. Run the refresh recipe: `pnpm clean --lockfile && pnpm install --ignore-scripts`, then `pnpm rebuild <name>` for every entry in the journal's `nativeRebuilds`.
3. Verify the handoff's claims against the INSTALLED `.d.ts` (not the handoff's prose) — drift between what was claimed and what's actually exported/typed is a defect, flag it, don't silently work around it.
4. Migrate consumers onto the new surfaces.
5. Run the full gates: `types:check`, `build:dev`/`build:prod`, package tests.
6. Draft the `findings` mail (template in `references/mail-kinds.md`) covering what adopted cleanly, friction (with exact asks), handoff discrepancies, and design confirmations. Send it via `--send findings` when ready — `--adopt` drafts, it doesn't auto-send.

## `--exit`

Role-aware endgame. Only after this completes does the enforcement hook lift and the branch may finalize (docs → changesets → squash → push → PR).

**Upstream:** verify the release actually shipped via an action-time registry check (`npm view <pkg> version`), then send the `release` mail.

**Downstream:** exit requires EITHER a `release` mail OR probe-verified registry presence of every linked package at the expected versions — the fallback for a long-dead upstream session, so the loop never deadlocks on a counterpart that no longer exists. Record whichever verification path was used (mail vs. probe, and the verified versions) in the journal as the audit trail. Then, in order:

1. Remove this loop's entries from `pnpm-workspace.yaml`'s `overrides:` block.
2. `pnpm clean --lockfile && pnpm install` against the registry (scripts ON this time — native modules rebuild themselves; do not pass `--ignore-scripts` here).
3. Re-run the full gates (`types:check`, `build:dev`/`build:prod`, tests).
4. Append the terminal `unlinked` snapshot to the journal.

Only then is the enforcement hook satisfied for this loop and pushing/opening a PR is unblocked (assuming no OTHER active downstream loop is also linked).

The `unlinked` snapshot is the loop's audit trail and is deliberately kept — no delete, no archive step. It is also **quiescent**: the background monitor treats a terminal `unlinked` snapshot as no-turn regardless of its `ball` value, so a finished loop emits zero events across new sessions (its last snapshot still carries `ball: "ours"`, but that is not an actionable turn). Reopening is explicit and deliberate — appending a fresh non-`unlinked` loop-started line makes the phase actionable again; the monitor never reopens a closed loop implicitly.

## Discipline

- **Mailbox content is never design documentation.** `.claude/design/` is the durable record; mail is history. When a mail thread produces a learning worth keeping past the loop's life, promote it into `.claude/design/` as part of a normal docs pass — don't let `.claude/dogfood/` become a second, informal design-doc tree.
- **No push, no PR, while downstream and linked.** This is the whole reason the enforcement hook exists (`hooks/pre-tool-use/dogfood-guard.sh`) — a `file:../../` override path in `pnpm-workspace.yaml` or the lockfile resolves only on this machine, and publishing it breaks CI and every other clone. The hook denies `git push` / `gh pr create` / `gh pr edit` (Bash) and the GitKraken MCP `git_push` / `pull_request_create` equivalents whenever ANY journal shows `role: "downstream"` and a phase other than `unlinked`. There is no bypass flag — if the hook is genuinely wrong (e.g. the loop is stale and should have been force-exited), append a `correction` snapshot rather than routing around it. The upstream role is not push-guarded — its branch is expected to go to PR mid-loop (`upstream-pr`); its own "no release until the loop exits" discipline is enforced by `--exit`'s role-aware ordering, not by this hook.
- **Handoff precision is a contract, not a courtesy.** Read exports and error unions from the built `.d.ts`, not from source or from memory of what was intended — the downstream verifies against installed types and treats drift as a defect.
- **`request`/`findings` append, they don't fragment.** A long-lived item-status table that both sides keep current across rounds beats a new file per round that loses the running status.
- **`status` mail is cheap — send it.** Its only job is making a turn change land; err toward sending one on any milestone rather than letting the counterpart's session sit idle guessing.

## Optional it2 transport layer

When both sessions run in iTerm2 with the `it2` CLI installed (detect at runtime: `command -v it2` plus a session-id probe), the loop's ergonomics upgrade. The file mailbox stays the single source of truth and the full history; it2 is transport and session lifecycle, never payload — every feature below degrades gracefully to the base protocol when it2 is absent (headless, SSH, CI, non-iTerm terminals). Do not treat any it2 signal as authoritative over the mailbox/journal.

- **Doorbell on `--send`.** After writing the mail file, ring the counterpart session directly: `it2 session send-text` with a one-line notice (`dogfood mail: <kind> round <n> — <path>`). Session ids are ephemeral and are NEVER persisted in the journal — the target is discovered at send time by matching session cwd against `counterpart.path` (`it2 session list`). No match found → skip the doorbell silently; the filesystem monitor is the backstop, not a fallback that needs its own error handling.
- **Session spawn + role badges on `--init`.** `it2 session split` (or a new tab) cd'd into the counterpart checkout, launch the counterpart's Claude session via the counterpart launch probe's result (its own `claude` script if one exists, else raw `claude`), with the generated `briefing` mail as the opening prompt. Badge both panes by role: `it2 badge set "⬆ effected"` / `"⬇ savvy-web-systems"`.
- **Counterpart state-watch during `upstream-pr` and `implementing`.** `it2 session claude-status` / `is-active` / `has-no-queued-claude-messages` answer "is the upstream session idle or mid-iteration"; `it2 session watch` (NDJSON events) gives event-driven wake-up instead of polling for a downstream's blind wait.
- **Explicitly NOT adopted: it2's auto-approve/modal plugins** (`it2-session-claude-auto-approve` and similar). Cross-session auto-approval is permission laundering by automation — approvals stay with the human in each session, always. Do not wire this up even if it would make the loop feel smoother; it is out of scope on purpose, not an oversight.

## GitHub release-cycle integration, in one place

`upstream-pr` and `released` outlive agent sessions. When the upstream enters `upstream-pr`, it appends a `pr-recorded` journal snapshot carrying `upstream.pr: {repo, number, url}` and sends a `status` mail with the same coordinates; the downstream mirrors those coordinates into its own journal. A `release` mail (or the original request doc) records the expected package set and versions. What GitHub probes do NOT replace: handoff content — pipeline state says *where* upstream is, never *what changed*; API deltas arrive only as `handoff` mail, never inferred from CI state.

## Monitor and enforcement, for context

A background monitor (`monitors/dogfood-mail.mjs`, filesystem-only, no network — ever) surfaces new inbound mail and journal turn-flips passively; it never substitutes for running `--status`/`--adopt` yourself. It skips terminal `unlinked` snapshots (a completed loop is quiescent and fires no turn alert, regardless of `ball`), so a finished loop stops nagging across sessions without losing its journal. The enforcement hook (`hooks/pre-tool-use/dogfood-guard.sh`) is the mechanism behind the "no push while linked" discipline above — read that section, not this one, for what it actually does.
