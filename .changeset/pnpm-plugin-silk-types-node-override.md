---
"@savvy-web/pnpm-plugin-silk": patch
---

## Bug Fixes

Drop the @types/node override from the distributed pnpm config and bump rolldown-pnpm-config to ^0.2.0. The override forced an incompatible @types/node across every consuming workspace and broke type resolution; removing it lets each workspace resolve @types/node through its own catalog.
