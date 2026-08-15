---
"@savvy-web/mcp": minor
---

## Features

### repos_manage action deregister

`repos_manage` gains `action: "deregister"`, clearing a stale `submodule.<section>` registration from the superproject's local git config — the phantom entry `repos_inspect` drift reports as an orphan `localRegistrationDivergence`. It takes `section` (the registration name exactly as the drift report states it), refuses a section still backing a live manifest entry, and its markdown lists the config keys the removed section carried and says outright that nothing is staged, since local config is unversioned.
