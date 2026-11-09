---
"@savvy-web/cli": patch
---

## Bug Fixes

The `savvy` bin now registers `tsx` itself when it is executed as `.ts` source, so a direct run from a git hook, an MCP launcher, or a bare shell resolves linked sibling source. The published `.js` bin never takes that path.
