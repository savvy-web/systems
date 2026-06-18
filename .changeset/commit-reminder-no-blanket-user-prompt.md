---
"@savvy-web/silk-effects": patch
"@savvy-web/cli": patch
---

## Bug Fixes

### commit-quality reminder no longer fires on every prompt

The silk plugin injected the commit-create skill reminder on every `UserPromptSubmit` whose text mentioned a commit-adjacent verb (`commit`, `ship`, `finalize`, and the like). Because the trigger matched any mention — "look at the last commit", "revert that commit" — rather than an intent to create one, the block appeared on analysis, review, and status turns throughout a session and drowned out the turns where a commit was actually being composed.

The blanket `UserPromptSubmit` injection is removed. The commit-create directive is still delivered once per session by the SessionStart orientation block, and the message validation still runs as a just-in-time PreToolUse check on the actual `git commit` and `gh pr create` commands. The now-unused `savvy commit hook user-prompt-submit` subcommand and the `UserPromptSubmitEnvelope` and `userPromptSubmitContext` hook helpers are removed along with it.
