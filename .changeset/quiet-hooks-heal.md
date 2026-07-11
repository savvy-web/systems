---
"@savvy-web/silk": minor
---

## Breaking Changes

* The `changeset-push-guard` PreToolUse hook is removed. No hook blocks a commit or a push for a missing changeset any more. Whether a change needs a changeset is a human judgement — a hook can only see "commits exist, no changeset file", which cannot distinguish a user-facing fix from a docs-only branch, so blocking on that signal was wrong for a large and legitimate class of branches. Enforcement belongs in CI on the pull request, where the full diff is available and an override is an explicit, reviewable human act. The `SILK_SKIP_PUSH_CHECK` environment variable is retired with it and no longer does anything.

## Features

* New `Stop` hook `stop/changeset-nudge.sh` replaces the push guard with a non-blocking reminder. When a main-agent turn ends on a branch that has commits but no changeset, it emits a top-level `systemMessage` — shown to the user, not injected into the model's context. It emits no decision and no `additionalContext`, so it cannot block the turn and does not instruct the agent. It is debounced on `HEAD`, so it speaks once per commit state rather than once per turn, and because `SubagentStop` is a separate event, a subagent making many commits never triggers it. Set `SILK_SKIP_CHANGESET_NUDGE=1` to opt out.
* SessionStart orientation now directs the agent to the MCP tools as the source of truth for release state — `changeset_inspect` for the classified branch diff, `changeset_preview` for the rendered CHANGELOG, `changeset_deps_detect` and `workspace_info` — instead of inferring it from the file tree. It also no longer claims a commit-time changeset reminder exists, which was never implemented.

## Bug Fixes

* Hooks now resolve the working tree from the hook envelope's `cwd` rather than `CLAUDE_PROJECT_DIR`, via a new shared `hooks/lib/hook-env.sh`. `CLAUDE_PROJECT_DIR` is pinned to the session's primary checkout and does not track the directory a tool call runs in, so any hook reasoning about git state from it inspected the wrong tree whenever an agent worked in a git worktree. This affected `commit-fs` and the changeset-validate post-tool hook. Note that `SILK_PROJECT_DIR` is derived from `CLAUDE_PROJECT_DIR` and carries the same limitation, so it ranks below `cwd` in the new resolution order.
* All jq-parsing hooks now fail open on invalid JSON from stdin instead of aborting under `set -euo pipefail` with jq's exit 5. Previously only a missing jq binary was guarded.
* `commit-fs.sh` no longer aborts with an unbound-variable error when `CLAUDE_PROJECT_DIR` is unset; it fails open like every other hook.
* The force-push exclusion in `match-safe-bash.sh` now anchors its `-f` match as a whole token. The unanchored version substring-matched inside other arguments, so `git push --follow-tags` and any push to a branch whose name contains `-f` (`my-feature`, `add-fix`) were knocked off the auto-allow hot path and prompted unnecessarily. Genuine force-pushes, including `--force-with-lease` and `--force-if-includes`, remain excluded.
* Every hook in `hooks.json` now declares an explicit `timeout`; four previously fell back to the 60s default.
