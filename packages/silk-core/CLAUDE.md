# @savvy-web/silk-core

The bottom layer (L1) of the Silk package graph: schemas, tagged errors, and the frozen `PrBody` contract extracted from `@savvy-web/silk-effects`. Single root export (`.`), ESM, `meta: true` (this is a documented API surface). `@savvy-web/silk-effects` depends on it and re-exports every symbol under the same name, so consumers of silk-effects see no change.

## Rules

- **The L1 rule: no platform, no allowlist.** Nothing under `src/` may import `node:*`, `@effect/platform*` or `effect/unstable/process`, or read `process.*`. `__test__/boundaries.test.ts` walks `src/` and fails on the first offender; there is no exception list. The scanner (`__test__/utils/boundaries.ts`, unit-tested by `__test__/boundaries-scanner.test.ts`) tokenizes out comments and string/template/regex literals, catches `process` as an identifier (member, bracket, destructuring, interpolation) and every specifier form (`import … from`, bare `import`, `export … from`, `import()`, `require()`) against `node:*`, bare Node builtins, `process`, `@effect/platform*` and `effect/unstable/process`; the gate carries positive AND negative controls. `__test__/utils/` is a helper dir the vitest-agent discovery never collects — put tests beside it, not in it. Add a schema here ONLY if it needs no platform — anything that needs a `FileSystem`, a subprocess or a clock is a silk-effects service.
- **A candidate file that imports a silk-effects sibling stays in silk-effects.** Moving it here would invert the layer edge (`noImportCycles` would also reject it).
- **Kit ownership is unchanged.** `VersioningStrategy`/`TagStyle`/`PublishTarget` come from `@effected/workspaces` — a PEER, not a dependency, because `SilkPublishConfig` extends its `PublishConfig` class and `AnalyzedWorkspace` carries its value classes, so silk-core and silk-effects (which also peers on it) must resolve the same single copy or `instanceof`/schema identity breaks across the layer edge; `Section`/`SectionId`/`CommentStyle` from `@effected/templates`, the issue-reference grammar from `@effected/github-references`. `src/index.ts` re-exports nothing from the kit.
- **`PrBody.Markers` is FROZEN** — the `silk-release:` token names the contract, not the emitting action. Byte-parity with `silk-release-action` is pinned by `__test__/fixtures/pr-body/expected.json`; `__test__/pr-body/skill-sync.test.ts` drift-lints `plugins/silk` skills against the literals.
- **Cross-package `{@link}` targets use backticks.** A symbol that lives in silk-effects (`BiomeSchemaSync`, `ChangesetConfigReader`) cannot be linked from here without an `ae-unresolved-link` warning.
- **Manifest wiring:** keep `"prepare": "turbo run build:dev"` — silk-effects consumes this package as `workspace:*` through a `link:` into `dist/dev/pkg`. See `.claude/design/workspace/install-orchestration.md`.

## Design

What moved, the L1 boundary test, the shared scanner, why `@effected/workspaces` is a peer:
→ `@../../.claude/design/silk-core/architecture.md`
Load when moving a symbol across the silk-core/silk-effects edge or changing the boundary scanner.

The four-layer package graph and the carrier pattern this package is the floor of:
→ `@../../.claude/design/workspace/package-layering.md`
Load when adding a dependency edge to or from this package.
