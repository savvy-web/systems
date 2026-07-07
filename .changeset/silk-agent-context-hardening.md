---
"@savvy-web/silk": patch
---

## Bug Fixes

Hardens the silk plugin's Biome nudge hook and tsdoc monitor so they stop pointing agents at actions they cannot take, or should not take yet.

* The `biome_check` nudge no longer fires inside subagents. Subagents run with a curated `tools:` allowlist and often cannot call the MCP tool the nudge recommends, so the reminder was a dead end.
* The nudge now matches Biome only when it is the invoked binary, not when the word "biome" merely appears as an argument — for example inside a `gh issue create --body` text.
* The tsdoc monitor debounces: it waits for a package's ae-*/tsdoc- count to hold steady across a short quiet period before notifying, so an agent actively fixing diagnostics no longer triggers churn. The notification also tells the reader to let an in-flight fix finish before dispatching another.
