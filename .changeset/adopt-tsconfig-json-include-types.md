---
"@savvy-web/tsdown-plugins": patch
---

## Other

The portable tsconfig resolver now gets `types` from `@effected/tsconfig-json@0.4.0`'s new `includeTypes` opt-in on `PortableTsconfig.make`, instead of a local merge-back step that re-added `types` after the kit's allow-list filter dropped it. The resolver bumps to `^0.4.0` and passes `{ includeTypes: true }` into `make`, and the destructure-and-reassign workaround is gone.

The emitted meta tsconfig carries the same keys and values as before, still `types: ["node"]` with `typeRoots` dropped. The only observed change is that `types` now sits in the position the kit's own allow-list places it rather than being appended last by the old mutation, so the JSON key order shifted; no consumer of this JSON reads it positionally.
