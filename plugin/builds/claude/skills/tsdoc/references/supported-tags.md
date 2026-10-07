# Supported tags

The generated per-package `tsdoc.json` enables the full `@microsoft/tsdoc` standard tag set. These — and any tags you register (`custom-tags.md`) — are the **only** tags that will not raise `tsdoc-undefined-tag`. Linked tags point at the upstream tsdoc.org reference for full semantics.

## Release tags (modifier)

See `release-tags.md` for policy. `@public`, `@beta`, `@alpha`, `@internal`, `@experimental`. `@experimental` is a synonym for `@beta`; prefer `@beta` within this toolchain.

## Content (block tags)

| Tag | Use |
| --- | --- |
| [`@remarks`](https://tsdoc.org/pages/tags/remarks/) | The detailed section after the one-line summary. |
| [`@example`](https://tsdoc.org/pages/tags/example/) | A worked usage example; one per block. |
| [`@param`](https://tsdoc.org/pages/tags/param/) | Document a parameter: `@param name - description`. |
| [`@returns`](https://tsdoc.org/pages/tags/returns/) | Describe the return value (no brace type). |
| [`@typeParam`](https://tsdoc.org/pages/tags/typeparam/) | Document a generic type parameter. |
| [`@throws`](https://tsdoc.org/pages/tags/throws/) | A condition under which the member throws. |
| [`@defaultValue`](https://tsdoc.org/pages/tags/defaultvalue/) | The default of an optional property/field. |
| [`@deprecated`](https://tsdoc.org/pages/tags/deprecated/) | Mark deprecated; include the migration path. |
| [`@privateRemarks`](https://tsdoc.org/pages/tags/privateremarks/) | Notes stripped from published docs. |
| [`@see`](https://tsdoc.org/pages/tags/see/) | A cross-reference. |

## Inline tags

| Tag | Use |
| --- | --- |
| [`@link`](https://tsdoc.org/pages/tags/link/) | `{@link Target}` cross-reference. |
| [`@inheritDoc`](https://tsdoc.org/pages/tags/inheritdoc/) | `{@inheritDoc Target}` to inherit a doc. |
| [`@label`](https://tsdoc.org/pages/tags/label/) | Declaration reference label. |

## Modifiers

| Tag | Use |
| --- | --- |
| [`@readonly`](https://tsdoc.org/pages/tags/readonly/) | Mark as read-only. |
| [`@sealed`](https://tsdoc.org/pages/tags/sealed/) | Class/member must not be extended/overridden. |
| [`@virtual`](https://tsdoc.org/pages/tags/virtual/) | May be overridden. |
| [`@override`](https://tsdoc.org/pages/tags/override/) | Overrides an inherited member. |
| [`@eventProperty`](https://tsdoc.org/pages/tags/eventproperty/) | Property is an event. |
| [`@decorator`](https://tsdoc.org/pages/tags/decorator/) | Embed a decorator in the doc. |
| [`@packageDocumentation`](https://tsdoc.org/pages/tags/packagedocumentation/) | Marks the entry-level doc comment — **entry files only** (see below). |

`@packageDocumentation` goes **only** in an entry-point file — a module listed in the package `exports`/`main` (e.g. `src/index.ts`). One per entry, not one per package: each `exports` entry is a separate bundle and API-model run, so a multi-entry package like `exports: { ".": "./src/index.ts", "./testing": "./src/testing.ts" }` carries a `@packageDocumentation` block in **both** `index.ts` and `testing.ts`. It does **not** belong on leaf/implementation files that are not themselves entries; those get ordinary symbol-level TSDoc. A `@packageDocumentation` block on a non-entry file is a mistake — move it to the entry that pulls the file in.

Neither of these is guaranteed to raise an `ae-*`/`tsdoc-*` diagnostic, so treat both as proactive authoring rules, not just as fixes for something `issues.json` reported:

- A stray `@packageDocumentation` on a non-entry file does not reliably fail the build — no diagnostic means it silently sits there, wrong, until someone greps for it.
- Related but distinct: a module-overview comment at the top of a non-entry file (especially `internal/*`) should be a `//` line comment, **not** a `/** ... */` doc-comment block. API Extractor parses and preserves `/**` (double-star) blocks — a `/**` block is treated as a doc comment, can attach to the declaration that follows it, and any bare `@` or `{@link}` inside its prose is eligible to raise a `tsdoc-*` warning. Plain `//` line comments (and single-star `/*` blocks) are ignored entirely by the API Extractor pass. Reserve `/**` for documenting an actual exported declaration, or for the entry-point's `@packageDocumentation` block itself. Narrating a non-entry module with `//` also removes the temptation to reach for `@packageDocumentation` on that file in the first place.

The `@jsx*` family (`@jsx`, `@jsxRuntime`, `@jsxFrag`, `@jsxImportSource`) is also enabled but rarely relevant outside JSX runtime config.
