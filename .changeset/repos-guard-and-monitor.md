---
"@savvy-web/silk": minor
---

## Bug Fixes

The repos Bash guard classifies `git config`, `git submodule` and `git remote` by their flags and subverb rather than by name, because each is read-or-write depending on how it is invoked and a by-name list cannot express that.

Reads that were denied now pass: `git config --get`/`--get-regexp`/`--get-all`/`--list`, `git submodule status`/`summary`, and `git remote -v`/`show`/`get-url`. A submodule's config key embeds its own path by construction, so `submodule..repos/<name>.url` looked like a vendored path while actually addressing the superproject's `.git/config` — which meant no submodule config key could be read at all.

A write that was permitted now denies: `git remote set-url` against a vendored tree. `remote` sat on the by-name read list, so every one of its write forms passed.

A `sed -i` whose expression mentions `.repos/` is no longer denied when its file operands sit outside it. The expression is not a path, and scanning every token could not tell the two apart; positional parsing cannot resolve it either, since BSD `sed -i ''` takes a backup-suffix argument GNU `sed -i` does not. A `.repos/` file operand still denies, expression or not.

The `gitmodules-drift` monitor sweeps once at startup. Its watchers only fire on a change to `.gitmodules` or `.repos/config.json`, so drift that already existed when a session opened was invisible — and two drift kinds touch neither file by construction, a stale local registration living in `.git/config` and a diverged nested submodule living inside a vendored tree. The sweep is delayed past the SessionStart hook's own `savvy repos sync` so it never reads a tree mid-unlock.

## Features

Dropping a stale submodule registration is now reachable from Bash: `git config --remove-section submodule.<name>`, `--unset`, `--unset-all`. This is the remedy the drift report names for an orphaned registration, and no tool performs it, so denying it left a detected problem with no sanctioned fix. Narrow by design — removal verbs only, local config only, and every `.repos/`-mentioning token must be a `submodule.<name>` key rather than a path.

## Documentation

The repos skill states the vendored posture directly: a vendored submodule is not yours to fetch, update, or manage from a git client, and `sync` declares that to git rather than leaving a permission error to announce it. It also covers the worktree-only lock scope and what it does and does not prevent, the two new drift kinds, why a re-vendor must carry `orientation` across by hand, and a crash-recovery runbook for `rename`, which has no rollback and does not resume on a blind retry.

Guard fixtures name the canonical vendored path instead of a gitdir name this repo no longer carries.
