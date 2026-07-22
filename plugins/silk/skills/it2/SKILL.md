---
name: it2
description: >
  Orchestrating iTerm2 panes and windows for subagents with the raw it2 CLI —
  pinned split-direction semantics, a layout heuristic for matching pane
  geometry, grid recipes, badging, and the dismiss-and-close discipline for
  torn-down subagents. Use when asked to split panes for agents, arrange the
  terminal, run subagents in parallel panes, or manage iTerm2 windows.
  Self-contained: drives it2 directly, does not assume the it2-skills
  marketplace plugin is installed.
when_to_use: >
  "split panes for these agents", "arrange my terminal", "run these in
  parallel panes", "manage iTerm2 windows", "badge this pane", "lay out my
  terminal windows", "close idle agent panes", "spread agents across
  monitors", "give each subagent its own pane"
---

# it2 pane orchestration (`/silk:it2`)

This skill is gated by the SessionStart `<terminal>` block: it only fires
when the session actually runs in iTerm2 with the `it2` CLI installed. If you
landed here without that block having appeared, verify the gate yourself
first — `TERM_PROGRAM` is `iTerm.app` (or `LC_TERMINAL` is `iTerm2`) and
`command -v it2` succeeds — before running anything below.

Everything here drives the raw `it2` CLI directly. It does not assume the
separate `it2-skills` marketplace plugin is installed, and none of it belongs
in a hook: geometry queries and every `it2` call happen at point of use, when
you are actually about to orchestrate, never in SessionStart.

## Split-direction semantics (pinned — this gets inverted routinely)

- `it2 session split --vertical` (`-v`) → the new pane lands to the RIGHT of
  the session you split: side by side, a vertical divider line.
- `it2 session split --horizontal` → the new pane lands BELOW the session you
  split: stacked, a horizontal divider line.
- No direction flag → auto: it2 picks vertical when the split session is
  wider than it is tall, horizontal otherwise — the same rule the heuristic
  below extends.

Read the flag name as "the divider is vertical" / "the divider is
horizontal," not "the panes stack vertically." Getting this backwards turns a
side-by-side layout you wanted into a stacked one, or the reverse.

## Layout heuristic

| Situation | Layout | it2 call |
| --- | --- | --- |
| Tall / portrait pane (height at or above width) | Stack top/bottom | `split --horizontal` |
| Wide / landscape pane | Side by side | `split --vertical` |
| Many subagents in one wide window | Grid: alternate directions, do not cram one axis | mix of both |
| Multiple windows or monitors available | Spread agents across them before over-splitting one window | new window, or target a session by its window frame |

Default: prefer a bare `it2 session split` (its own auto-direction) for a
single split. Force a direction only to build a grid or to spread
deliberately across windows/monitors.

## Geometry queries (call these when you are about to orchestrate)

- `it2 window list --format json` — one entry per window: `frame` (pixel
  origin and size), `fullscreen`, `tab_count`. The array length is the window
  count. Two windows whose `frame` origins land in different, non-adjacent
  pixel ranges are almost certainly on different monitors.
- `it2 session get-info <session-id> --format json --extract grid_size` (or
  `--format json | jq .grid_size`) — the pane's cell dimensions (columns,
  rows). Compare width against height for the portrait/landscape signal the
  heuristic table keys off.

Both are read-only queries; run them fresh at the moment you need the
answer rather than caching a layout decision from earlier in the session.

## Grid recipes

`it2 session split --help` documents the positioning caveat directly:
splitting the SAME session more than once puts every new pane next to the
ORIGINAL, not next to the pane you just created — the naive "split, then
split the result" mental model produces the wrong grid.

- To chain panes in a row or column, split off the newly created session's
  id each time, not the original one.
- `--before` places the new pane before/above the session being split
  instead of after/below, which is how you control which side of a pair the
  new pane lands on: `it2 session split -v --before` then
  `it2 session split -v` around the same origin session yields
  `[new] [original] [new]`.
- `it2 session move <source-session-id> <destination-session-id>
  [--vertical] [--before]` re-parents an EXISTING session as a split pane of
  another — reach for this to reflow a grid after the fact instead of
  closing and re-splitting from scratch.
- `--badge <text>` on `split` sets the new pane's badge in the same call, so
  a spawn-and-badge step can be one command instead of two.

## Badging

`it2 session badge set [<session-id>] "<text>"` (omit the session id to
target the current session). Badge every pane you spawn for a subagent with
a session-id prefix, so the user can tell which pane belongs to which
dispatch at a glance — for example
`it2 session badge set "$PANE_SID" "${SUBAGENT_ID}: turborepo"`.

## Dismiss-and-close discipline

When a subagent is done and you do not intend to retask it, dismiss the
dispatch, then close its pane — the two go together, never one without the
other, and never "leave it idle just in case." `it2 session close
<session-id>` (add `--force` to skip the confirmation prompt; it also
accepts multiple session ids in one call). No orphaned panes and no idle
agents left sitting in a split after the work that spawned them has ended.

## When NOT to orchestrate

- A single, trivial subagent dispatch — do not split a pane for one quick
  fire-and-forget task.
- The user has not asked for parallelism and the work does not call for
  it — do not manufacture panes to look busy.
- Headless or no real iTerm2 window (plain SSH terminal, CI, tmux without
  iTerm2). The SessionStart gate should have kept this skill from firing in
  that case; if it did anyway, re-check `command -v it2` and
  `TERM_PROGRAM`/`LC_TERMINAL` before calling anything.
