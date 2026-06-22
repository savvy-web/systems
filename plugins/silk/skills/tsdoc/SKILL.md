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

Every exported declaration needs **exactly one release tag**. Default binary policy: consumer-facing API → `@public`; a type that only leaks into the rollup → `@internal`. `@beta`/`@alpha` are a deliberate human choice, not an agent default. Full decision tree: `references/release-tags.md`.

## Document the whole public surface

Public exports are rendered into cross-linked API reference sites by `rspress-plugin-api-extractor`, so passing the build is the floor, not the goal. For every `@public` symbol: write a one-line summary on the export **and on each property/member** (they render as individual rows), push depth into `@remarks`, keep maintainer-only notes in `@privateRemarks`, and add an `@example` that is a complete, compilable program (separate `import type` for types) with any output shown in a `// =>` comment. Full guidance: `references/doc-quality.md`.

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
