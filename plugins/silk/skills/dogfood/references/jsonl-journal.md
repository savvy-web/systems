# The JSONL state journal — full snapshot-line shape

One JSONL file per loop, per repo: `.claude/dogfood/<counterpart-id>.jsonl`, gitignored, hand-appended — **never edited in place**. Each line is a complete snapshot of the loop's state plus an event annotation.

## Why append-only snapshots, not a mutable JSON document

- **Current state = the last valid line.** No fold/reduce logic anywhere — the hook and the monitor both read exactly one line.
- **History = the file.** Every ball-flip, phase change, and mail exchange is a line; the journal reads like a log because it is one.
- **Corrections are appends.** A wrong entry is superseded by appending a corrected snapshot (`event: "correction"`), never by editing in place — safer for hand maintenance than in-place JSON surgery, and the audit trail keeps the mistake visible.
- **Corrupt tails self-heal.** A malformed last line (a session killed mid-write) is skipped; readers walk back to the previous valid line, and the next append supersedes the damage. Both the enforcement hook and the monitor implement this walk-back.
- **A new collaboration with the same counterpart continues the same journal.** A fresh `loop-started` line follows a terminal `unlinked` one. No key collisions, no archival ceremony — durable narrative history is the mail files, not the journal.

Repeating the static config (`counterpart`, `packages`, `linkType`) on every line costs bytes and buys the no-fold property. The trade is deliberate — don't "optimize" it into a diff-only format.

## Snapshot line shape (downstream side)

Shown expanded for readability; each snapshot is ONE line on disk (no pretty-printing when you actually append it — `jq -c` or equivalent).

```jsonc
{
  "at": "2026-07-16T21:40:00Z",
  "event": "mail-received",                     // loop-started | mail-sent | mail-received
                                                //   | phase-change | pr-recorded | correction | unlinked
  "role": "downstream",                          // this repo's role in the loop
  "counterpart": { "id": "effected", "path": "../../spencerbeggs/effected" },
  "packages": [
    { "name": "@effected/npm", "override": "file:../../spencerbeggs/effected/packages/npm/dist/prod/npm/pkg" }
    // … full transitive closure of linked packages
  ],
  "linkType": "pnpm-overrides",                  // future: "bun"
  "nativeRebuilds": ["better-sqlite3"],          // `pnpm rebuild` targets after --ignore-scripts installs
  "phase": "adopting",
  "ball": "ours",
  "round": 2,
  "upstream": { "pr": { "repo": "spencerbeggs/effected", "number": 84, "url": "…" } },  // once known
  "lastMail": {
    "in": ".claude/dogfood/effected/2026-07-16-kit-handoff-round-1.md",
    "out": "../../spencerbeggs/effected/.claude/dogfood/savvy-web-systems/systems-dogfood-feedback.md"
  }
}
```

## Field notes

| Field | Notes |
| --- | --- |
| `at` | UTC ISO-8601 timestamp of the append, not of whatever event it describes. |
| `event` | One of `loop-started`, `mail-sent`, `mail-received`, `phase-change`, `pr-recorded`, `correction`, `unlinked`. Pick the one that best names what triggered this append; several fields typically change together (e.g. `mail-received` usually also updates `phase`/`ball`/`lastMail.in`). |
| `role` | `"downstream"` or `"upstream"` for THIS repo, in THIS loop. A repo can be downstream in one loop's journal and upstream in another's — role is per-journal, never global. |
| `counterpart` | Static across the loop's life; repeated on every line by design (see above). `path` is relative to this repo's root. |
| `packages` | Downstream only. The FULL transitive closure of linked `@scope/*` packages, each with the exact `pnpm-workspace.yaml` override string. Re-derive from the lockfile at `--init`/`--adopt` time — never trust a stale in-memory list. |
| `linkType` | `"pnpm-overrides"` today; `"bun"` is a reserved future value, not yet implemented — do not invent other values. |
| `nativeRebuilds` | Downstream only. Native-module names that need `pnpm rebuild <name>` after an `--ignore-scripts` install (e.g. `better-sqlite3`). Scan for these at `--init`/discover at `--adopt`. |
| `phase` | See the phase machine in `SKILL.md`. Exactly one of `requested`, `implementing`, `handoff`, `adopting`, `findings`, `upstream-pr`, `released`, `unlinked`. |
| `ball` | `"ours"` or `"theirs"` — whose move it is. Every mail kind deterministically flips or keeps it. |
| `round` | Monotonic, shared by both sides. `briefing` is round 0. |
| `upstream.pr` | Present only once the upstream's branch has gone to review (`pr-recorded` event, `upstream-pr` phase). Mirrored into the downstream's own journal from the upstream's `status` mail. |
| `lastMail.in` / `lastMail.out` | Receiver-repo-relative path to the most recent inbound mail; counterpart-repo-relative (i.e. starting `../../`) path to the most recent outbound mail. The monitor's new-mail detection keys off `lastMail.in`. |

## Upstream-side snapshot

The upstream repo's own journal for the same loop mirrors phase/ball but drops what it doesn't own:

- `role: "upstream"`.
- No `packages` / `nativeRebuilds` — the upstream links nothing.
- Otherwise the same shape: `counterpart`, `phase`, `ball`, `round`, `lastMail`, and (once relevant) `upstream.pr`.

## Appending a line

There is no CLI/MCP tool for this in v1 (see the skill's Non-goals) — append by hand with `jq -c` (or equivalent) piped to `>>`, never `>`:

```bash
jq -nc \
  --arg at "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
  --arg counterpart_id "effected" \
  --arg phase "adopting" \
  --arg ball "ours" \
  '{at:$at, event:"mail-received", role:"downstream",
    counterpart:{id:$counterpart_id, path:"../../spencerbeggs/effected"},
    phase:$phase, ball:$ball, round:2}' \
  >> .claude/dogfood/effected.jsonl
```

Build the full object (packages, nativeRebuilds, lastMail) inline in the `jq` invocation rather than piecing it together with shell string concatenation — a malformed line just gets walked past by every reader, but it still pollutes the audit trail.
