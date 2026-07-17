---
"@savvy-web/github-action-builder": major
---

## Breaking Changes

- The build tool targets `effect@4` and ports its CLI from the dead `@effect/cli` to the in-core `effect/unstable/cli`; the four services convert to class-based `Context.Service` with exported `*Shape` interfaces.

## Other

- YAML parsing adopts `@effected/yaml`; eight unused `@effect/*` pins are removed.
