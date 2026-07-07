---
name: tsdoc
description: >
  Toolchain-accurate TSDoc authoring for the Silk Suite. How to document
  exported symbols so the @savvy-web/bundler API Extractor pass passes:
  release tags, fixing ae-forgotten-export / ae-missing-release-tag /
  tsdoc-* warnings, the supported-tag allow-list, and registering custom
  tags. Agents reach for JSDoc habits; this corrects them. Auto-loads when
  editing savvy.build.ts and is user-invokable on demand via /silk:tsdoc.
when_to_use: >
  "write a TSDoc comment", "document this function", "JSDoc vs TSDoc",
  "ae-forgotten-export", "ae-missing-release-tag", "tsdoc-undefined-tag",
  "tsdoc syntax error", "what release tag", "@public or @internal",
  "add a custom TSDoc tag", "suppress an api-extractor warning", "fix the
  api extractor warnings in my build", "forgotten export", "build fails on
  exports", "api extractor error in CI"
paths:
  - "**/savvy.build.ts"
  - "**/dist/*/issues.json"
---

# TSDoc for the Silk toolchain

This repo builds with `@savvy-web/bundler`, which runs Microsoft **API Extractor** over each package's public surface and **fails CI on forgotten exports**. Write **TSDoc**, not JSDoc — the toolchain enforces a specific subset and its own surface rules.

## JSDoc habits to drop

| JSDoc habit | TSDoc |
| --- | --- |
| `@param {Type} name desc` | `@param name - desc` (no brace type; hyphen required) |
| `@returns {Type} desc` | `@returns desc` (no brace type) |
| `@param name desc` (no hyphen) | `@param name - desc` |
| `@class` / `@function` / `@module` tags | omit — inferred from the declaration |
| no release tag on an export | exactly one of `@public` / `@internal` (see below) |

Types come from TypeScript, not from doc comments. Never restate a type in a tag.

## Fix-it quick map

| You see | Do this | Detail |
| --- | --- | --- |
| `ae-missing-release-tag` | add `@public` (real API) or `@internal` (rollup-only leak) | `references/release-tags.md` |
| `ae-forgotten-export` | export + `@public` the type, or `@internal` it | `references/diagnostics.md` |
| `ae-incompatible-release-tags` | a `@public` signature references an `@internal` type — make the tags compatible | `references/diagnostics.md` |
| `ae-unresolved-link` | fix the `{@link}` target or use a backtick code span | `references/diagnostics.md` |
| `tsdoc-undefined-tag` | fix the tag, or register it in `savvy.build.ts` | `references/custom-tags.md` |
| `@` in prose flagged | backtick-wrap or `\@`-escape scoped names like `@savvy-web/x` | `references/diagnostics.md` |
| other `tsdoc-*` | fix the syntax (hyphens, braces, escapes) | `references/diagnostics.md` |
| "what tags may I use?" | the standard set, all enabled | `references/supported-tags.md` |
| documenting a `@public` export | summary + each property; `@remarks`/`@privateRemarks`; compilable `@example` | `references/doc-quality.md` |

## The one rule that matters most

Every exported declaration needs **exactly one release tag plus a one-line summary** describing its purpose — a bare tag with no description is only half the fix, for `@public` and `@internal` alike. Default binary policy: consumer-facing API → `@public`; a type that only leaks into the rollup → `@internal`. `@beta`/`@alpha` are a deliberate human choice, not an agent default. (`@packageDocumentation` is the exception to tagging every export: it documents an entry as a whole and belongs only in an entry-point file — one per `exports` entry, e.g. both `src/index.ts` and `src/testing.ts` for a two-entry package — never on a non-entry leaf file.) Full decision tree: `references/release-tags.md`.

Neither mistake below reliably raises an `ae-*`/`tsdoc-*` diagnostic, so a clean `issues.json` doesn't mean they're absent — check proactively, don't wait for the build to flag them:

- **Never** add `@packageDocumentation` to a file that isn't itself an `exports` entry — a stray one is a bug, not a lint nit.
- Module-header narration on a non-entry file is a `//` line comment, not a `/** ... */` block — see `references/supported-tags.md` for why.

## Document the whole public surface

Public exports are rendered into cross-linked API reference sites by `rspress-plugin-api-extractor`, so passing the build is the floor, not the goal. For every `@public` symbol — and the `@internal` ones maintainers and agents read — write a one-line summary on the export **and on each property/member** (they render as individual rows), push depth into `@remarks`, keep maintainer-only notes in `@privateRemarks`, and add an `@example` that is a complete, compilable program (separate `import type` for types) with any output shown in a `// =>` comment. Re-exporting through barrel files (`export { X } from "./x.js"`) detaches a symbol from its declaration and is a doc-generation footgun — prefer explicit per-module exports, and flag a barrel to the user before refactoring it rather than reshaping exports yourself. Full guidance: `references/doc-quality.md`.

## A complete example

```ts
/**
 * Parses a Silk package manifest into a normalized descriptor.
 *
 * @remarks
 * Private packages return `null`; see {@link PackageDescriptor} for the shape.
 *
 * @param manifest - the raw `package.json` contents
 * @returns the descriptor, or `null` when the package is private
 * @throws when `manifest.name` is missing
 * @public
 */
export function parseManifest(manifest: PackageJson): PackageDescriptor | null {
  /* ... */
}
```

The `{@link PackageDescriptor}` above resolves only because `PackageDescriptor` is an exported symbol of the same package. Link only resolvable exports; otherwise use a backtick code span (see `references/diagnostics.md`).

## Verify your work

The build writes structured diagnostics to `dist/<target>/issues.json` (the `ae-*`/`tsdoc-*` ones live in `dist/prod/issues.json`, since the API Extractor pass is prod-only). Build, then read the artifact:

```bash
pnpm turbo run build:prod --filter <package> --force >/dev/null 2>&1
jq '{warnings: [.warnings[] | select((.code // "") | test("^(ae-|tsdoc-)"))],
     errors:   [.errors[]   | select((.code // "") | test("^(ae-|tsdoc-)"))]}' \
  <package-dir>/dist/prod/issues.json
```

A present file with empty `warnings`/`errors` (after the filter) means clean. An absent file means the package was not built. `generatedAt` is the artifact's timestamp — rebuild before trusting it after an edit. Reach for `suppressWarnings` (`references/custom-tags.md`) only for genuine false positives.

**Locate by `file:line`, falling back to the symbol name.** `ae-*`/`tsdoc-*` entries in `issues.json` now carry accurate `file`/`line`/`column` fields pointing at the true source declaration: the meta pass runs a second, diagnostics-only API Extractor run over a per-module declaration tree where each `.d.ts.map` references only its own source file, so positions resolve correctly. Navigate to the reported `file:line` to find the declaration to fix.

**Fall back to the symbol name when a location is absent or points at a `declarations/*.d.ts` mirror path.** Most diagnostics resolve to `src/*.ts` (accurate). The exception is Effect `Data.TaggedError`/service classes built from a synthesized `_base` declaration: rolldown-plugin-dts does not source-map the synthesized `_base`, so those diagnostics may name a path like `dist/prod/<id>/declarations/something.d.ts` rather than the original `src/*.ts`. In that case, map the `.d.ts` stem back to the matching `src/*.ts` file — the symbol name quoted in the entry's `text` (e.g. `The symbol "S3BlobStoreConfig" ...`) confirms which declaration to fix.
