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
  "linkType": "pnpm-overrides",                  // "file" also valid; future: "bun"
  "nativeRebuilds": ["esbuild"],                 // `pnpm rebuild` targets after --ignore-scripts installs
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
| `packagesDerived` | Downstream only. `false` means the linked-package closure has NOT been computed yet; `true` means it has, so an empty `packages` array genuinely means nothing is linked. Readers must treat `false` as potentially-linked and fail safe (savvy-web/systems#331). |
| `linkType` | `"pnpm-overrides"` or `"file"` today (`"file"` sanctioned alongside `pnpm-overrides` as of savvy-web/systems#338); `"bun"` is a reserved future value, not yet implemented — do not invent other values. |
| `nativeRebuilds` | Downstream only. Native-module names that need `pnpm rebuild <name>` after an `--ignore-scripts` install. DERIVE this by scanning the resolved tree, never from a remembered example — on the Effect v4 line `@effected/store` uses `node:sqlite` and needs nothing, while the common real answer in a vitest repo is `esbuild`, whose platform binary the skipped postinstall leaves missing. |
| `owner` | An opaque session-scoped token identifying which session wrote this snapshot. Exactly one session may hold a role in a loop; the append helper warns on a mismatch (savvy-web/systems#334). |
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

Append with `skills/dogfood/scripts/journal-append.sh` (savvy-web/systems#338) — it inherits the last valid line, patches only what you pass, validates the event/phase/ball enums, and appends only on success. This replaces hand-rolling the full `jq` object on every append.

Opening a loop:

```bash
bash journal-append.sh <journal-path> --init --role <downstream|upstream> \
  --counterpart-id <id> --counterpart-path <path> --link-type <pnpm-overrides|file> \
  [--note <text>] [--owner <token>]
```

`--init` derives the opening `ball` from `--role` per the phase table (`requested` → upstream's ball): a downstream repo gets `ball: theirs`, an upstream repo gets `ball: ours`. A downstream init writes `packages: []`, `packagesDerived: false`, and `nativeRebuilds: []`; an upstream init omits all three fields entirely, per the upstream-side snapshot shape below.

Every later append:

```bash
bash journal-append.sh <journal-path> --event <event> \
  [--phase <p>] [--ball <b>] [--round <n>] \
  [--mail-in <path>] [--mail-out <path>] [--note <text>] [--pr <repo#num>] \
  [--packages-derived true|false] [--owner <token>] \
  [--package '<name>=<override>' ...] [--clear-packages]
```

### Recording a closure derived mid-loop

`--package` (repeatable) and `--clear-packages` write the `packages` array on a later append, so a loop that opens link-lazy — `linkType` decided later, `packages: []`, `packagesDerived: false` — can record its real closure at the moment it installs one, instead of choosing between a false `packagesDerived: true` over an empty array and burying the authoritative list in `note` prose where no reader can consume it (savvy-web/systems#508):

```bash
bash journal-append.sh <journal-path> --event phase-change --phase adopting --ball ours \
  --package '@effected/templates=file:../../spencerbeggs/effected/packages/templates/dist/prod/npm/pkg' \
  --package '@effected/github=file:../../spencerbeggs/effected/packages/github/dist/prod/npm/pkg' \
  --packages-derived true
```

Rules, all enforced:

- **A snapshot is a complete state, so the flags REPLACE the array — they never merge.** The `--package` flags on one invocation name the whole closure; `--clear-packages` names an empty one. The two are mutually exclusive.
- **Downstream only**, checked against the prior line's `role` — an upstream journal carries no `packages` field at all.
- **A nonempty closure requires an effective `packagesDerived: true`** — passed on the same append, or already carried forward. Writing the array IS the derivation, so a nonempty `packages` alongside `packagesDerived: false` claims the closure is both known and underived, and the script refuses it rather than recording the contradiction. A link-lazy loop carries `false` forward from `--init`, so this is what you hit by default: pass `--packages-derived true` with the `--package` flags. `--clear-packages` is exempt — an empty closure asserts nothing, which is why `--exit` can clear without claiming a derivation.
- **Not valid with `--init`.** A new loop always opens with `packages: []`; a closure derived at init time is recorded by the follow-up append, same as one derived mid-round.
- `--clear-packages` is what `--exit`'s terminal `unlinked` snapshot uses to state the tree is unlinked explicitly, rather than leaving the last live closure standing in the final line.

Deriving the closure is unchanged and still `SKILL.md` `--init` step 3's job — from the counterpart's BUILT manifest, never its source manifest. These flags record a derivation; they do not perform one.

Only the flags you pass change; every other field (including `counterpart`, `packages`, `linkType`, `nativeRebuilds`, `role`) carries forward unchanged from the last valid line, walking back past a corrupt tail the same way the guard/monitor readers do. `role` is fixed for a loop — the script refuses `--role` outside `--init`; append a `correction` event instead. An owner-token mismatch against the last writer warns (savvy-web/systems#334) rather than rejecting. Nothing is appended unless the composed line validates — a rejected input leaves the journal file byte-identical.
