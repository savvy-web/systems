---
"@savvy-web/tsdown-plugins": minor
---

## Features

- A `normalizeLooseFiles` helper and `looseFiles` support in `buildTargetGroups`. Each loose file builds as one extra single-entry, bundled, declaration-free, manifest-free tsdown pass per target group, inheriting the group's bundling posture so the output is self-contained. The `ConfigValidator` validates loose files structurally (supported extension, format inference, and contradiction checks) before any build work.
