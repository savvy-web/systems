---
"@savvy-web/silk": minor
---

## Features

### `journal-append.sh --init --ball ours|theirs`

`--init` now accepts an optional `--ball` override of the role-derived opening ball. The role default (`requested` → upstream's ball) assumes round 1's `request` mail has already been sent; a loop opened before that mail exists — for example from a pre-filed issue — starts with the downstream owing the opening mail instead, inverting the default on both sides at once. Pass `--ball ours` on the side that owes the opening mail and `--ball theirs` on the other to state that explicitly at `--init` time rather than correcting it afterward.

```bash
journal-append.sh <journal> --init --role downstream --ball ours \
  --counterpart-id effected --counterpart-path ../effected --link-type pnpm-overrides
```

### `override-audit.mjs`

New warn-only script for the dogfood skill's `--init` and `--adopt` flows: `node scripts/override-audit.mjs`, pointed at the repo's `pnpm-workspace.yaml`, flags every `file:`/`link:` override whose target the registry would already satisfy at a version matching what consumers declare. That shape is exactly an over-derived link closure — an override that never needed to exist. A warning is a prompt to re-check the derivation while the entry is still cheap to remove, not a failure; a deliberate override of a package the upstream hasn't yet published is the normal mid-loop state.

## Documentation

* The dogfood skill's counterpart briefing now states in prose whose ball it is and what the opening move is, cross-referenced from both `--init` step 6 and the `release` mail's per-package registry-probe requirement.
* `--exit` documents its ordering explicitly: the linked-loop safety net (the `file:` override) and the semver check are never both present at once — while linked there is a net and no check, at `--exit` there is a check and no net — which is why a stale declared range passes every gate green until the exact moment the override is removed. `--adopt` step 5 (bump declared ranges while still linked) is reframed around this same distinction.
* `--status` and the upstream side of `--exit` now probe the registry once per package in a release cut, not once for the cut as a whole — multi-package cuts publish staggered, so a green release workflow does not mean every package is installable yet.
* New Discipline rule: a coherent-kit differential probe only proves what its fixture exercises. A fixture that omits the disputed case (e.g. a known divergence between two implementations) proves nothing about it, even when the probe passes.
