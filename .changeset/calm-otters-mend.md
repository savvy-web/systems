---
"@savvy-web/silk": patch
---

## Bug Fixes

* The dogfood mail monitor no longer announces a session's own journal append as an inbound turn — it now surfaces mailbox changes before evaluating journals and suppresses a flip whose triggering mail it had already surfaced on an earlier tick.
* The `repos` pre-tool-use bash guard now recognizes a `git` invocation that names a vendored path within its own clause, instead of requiring an explicit directory flag, so sanctioned `git mv` and `git rm --cached` commands against vendored paths are no longer blocked. A plain `git rm` or a bare `rm` against a vendored path is still denied.

## Documentation

* The dogfood skill states the artifact-verification method — recursive search, citing the module path found, and checking a known-present control symbol before reporting an absence — and adds two protocol rules: a repo that is downstream in one loop and upstream in another owes its downstream a status when its own upstream ships, and a reopened loop may boot from a briefing carrying the current round rather than round zero. The tsdoc skill notes that a verbatim code or type transcription inside a doc comment needs a fenced block, since bare braces and angle brackets are read as TSDoc syntax.
