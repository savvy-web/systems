---
"@savvy-web/silk": patch
---

## Bug Fixes

* The dogfood-mail monitor no longer re-fires the "your turn" alert for a finished loop whose journal ends on the terminal `unlinked` phase, so a completed loop stays quiescent across new sessions. Appending a fresh loop line reopens it deliberately.
