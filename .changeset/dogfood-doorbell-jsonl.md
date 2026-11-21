---
"@savvy-web/ai-plugins": patch
---

## Bug Fixes

The dogfood doorbell now sends once with `it2 session send-text --skip-confirm` instead of retrying into duplicate notices. The journal append script and the journal readers tolerate torn tails per the `@effected/jsonl` envelope model: an append first closes an unterminated fragment so the new snapshot lands on its own line, every reader treats only an envelope frame (string `at` and `event`) as a valid snapshot, and the `dogfood-mail` monitor reads each journal incrementally from a byte cursor, holding back an unterminated tail and re-reading a truncated or replaced journal from zero.
