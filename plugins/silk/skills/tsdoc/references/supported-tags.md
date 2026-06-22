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
| [`@packageDocumentation`](https://tsdoc.org/pages/tags/packagedocumentation/) | Marks the package-level doc comment (top of the entry file). |

The `@jsx*` family (`@jsx`, `@jsxRuntime`, `@jsxFrag`, `@jsxImportSource`) is also enabled but rarely relevant outside JSX runtime config.
