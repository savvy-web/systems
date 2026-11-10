---
"@savvy-web/silk": patch
---

## Bug Fixes

The `savvy` and `savvy-mcp` carrier bins now register `tsx` themselves when executed as `.ts` source, so a direct run resolves linked sibling source. The published `.js` bins never take that path.
