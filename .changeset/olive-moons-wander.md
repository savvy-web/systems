---
"@savvy-web/silk": patch
---

## Bug Fixes

The dogfood mail monitor no longer replays a finished collaboration's mail as unread.

New mail is detected by comparing mailbox files against the journal's `lastMail.in` pointer. When that pointer could not be resolved — it is absent on a loop that has received nothing yet, and stale when a hand-authored journal append names a file that does not exist — the watermark fell back to zero, which made every file in the mailbox count as newer. Reopening a loop against an existing journal therefore surfaced the entire archive of the previous collaboration in one burst.

The fallback is now the current loop's `loop-started` timestamp, so mail predating the collaboration cannot be new to it.

* `lastMail.in: null` stays honest for a freshly opened loop instead of having to be back-dated to a previous loop's file to silence the noise
* A dangling pointer degrades to the same bounded watermark rather than to everything
* A journal with no `loop-started` line keeps the previous behavior and still surfaces mail
