# Diagnostic fix recipes

The `@savvy-web/bundler` API Extractor pass surfaces three families. Config is programmatic (set by `@savvy-web/tsdown-plugins`, which also generates the per-package `tsdoc.json`) — there is no `api-extractor.json` to edit. Fix the cause — do not reach for suppression first (see `custom-tags.md` for the legitimate suppression escape hatch).

## `ae-forgotten-export`

**Severity:** error in CI (fails the build), warning locally. (It is a warning in API Extractor's own model; the bundler escalates it to a hard error when `CI` is set.)

**Cause:** a `@public` declaration references a type that is not itself exported, so it would be missing from the published rollup.

**Fix — an API-surface decision, not a comment edit.** First determine where the referenced type comes from; the fix differs:

**Case 1 — in-package unexported type** (the type is declared in this package but not exported):

- If consumers need the type: export it and give it `@public`.
- If the type is an internal detail: mark it `@internal` (the referencing member or the type itself). API Extractor then treats it as part of the internal surface and stops warning, while keeping it out of the public docs.

**Case 2 — externally-inlined dependency type** (the type comes from a dependency — often a devDependency — and the bundler inlines it into the rolled-up `.d.ts`, e.g. an Effect signature leaking `FileSystem` from `@effect/platform` as `FileSystem_2`): `@internal` on the referencing member does **not** clear the warning — the external type is physically present in the bundle regardless of the member's release tag. The real fixes are:

- remove the public export entirely, or
- promote the dependency to a runtime dependency and externalize it so the type resolves as an external import instead of being inlined, or
- restructure the signature so the external type is not part of the public surface.

```ts
// before: Options is referenced by a @public function but not exported → ae-forgotten-export
interface Options { retries: number }

/** @public */
export function run(opts: Options): void {}

// after (consumers need it):
/** @public */
export interface Options { retries: number }

// after (internal detail):
/** @internal */
export interface Options { retries: number }
```

## `ae-missing-release-tag`

**Severity:** warning. **This is usually the bulk of the backlog.**

**Cause:** an exported declaration has no release tag.

**Fix:** add one per the binary policy in `release-tags.md` — `@public` for real API, `@internal` for rollup-only leaks. Do not blanket-tag everything `@public`; a leaked helper should be `@internal`.

**Known limitation — `export * as NS` namespaces always trigger this.** Rolldown's dts generation drops the doc comment from an `export * as NS from "./mod.js"` statement: the rollup contains a generated, un-commented `declare namespace <mod>_d_exports` that API Extractor flags (`index_d_exports`, `Step_d_exports`, `_d_exports$1`, …). There is **no package-source fix** — `@public` on the `export * as` statement never reaches the generated namespace, and the import-then-named-export form collapses to the same output. The sanctioned workaround is a narrow `meta.tsdoc.suppressWarnings` entry in `savvy.build.ts`, keyed on the synthetic suffix:

```ts
{ messageId: "ae-missing-release-tag", pattern: "_d_exports" }
```

(as applied in `silk-effects` and `github-action-effects`). Do not chase this per-symbol; it is a bundler limitation, not a missing tag.

## `ae-incompatible-release-tags`

**Severity:** warning.

**Cause:** a `@public` symbol's signature references a symbol with a less-visible tag (e.g. a `@public` function returns or extends an `@internal` type). The public surface would reference something not in it.

**Fix:** make the tags compatible. Either promote the referenced type to `@public` (if consumers legitimately touch it through the signature), or lower the referencing member to match. Do not silence it — an incompatible tag pair means the public API leaks a type it claims is internal.

```ts
// before: @public function returns an @internal type → ae-incompatible-release-tags
/** @internal */
export interface RawState { /* ... */ }

/** @public */
export function load(): RawState {} // public signature exposes an @internal type

// after: the type is reachable through public API, so it is public
/** @public */
export interface RawState { /* ... */ }
```

## `ae-internal-missing-underscore` (disabled — do not act on it)

This monorepo does **not** use the underscore-prefix convention for `@internal` exports. The check is turned off in `@savvy-web/tsdown-plugins`' API Extractor message config, so the build never emits it. Do **not** rename internal exports with a leading `_`; mark them `@internal` and leave their names as written.

## `ae-unresolved-link`

**Severity:** warning.

**Cause:** an `{@link Target}` whose `Target` cannot be resolved — a typo, a symbol that is not exported, or a declaration kind that is not linkable.

**Fix:** point the link at an exported, linkable symbol, or drop the `{@link}` and use plain text / a backtick code span. Cross-package links must reference a symbol the model actually exports.

One non-obvious case: a symbol your package *re-exports from a dependency* (e.g. `export { runBuild } from "@savvy-web/bundler"`) can still fail with "this type of declaration is not supported yet by the resolver" — API Extractor does not follow re-exported external declarations even though the export is valid. Use a backtick code span for those, not `{@link}`.

```ts
// before: BuildConfig is not an export of this package → ae-unresolved-link
/**
 * @remarks See {@link BuildConfig} for options.
 * @public
 */

// after: link a real export, or use prose
/**
 * @remarks See {@link RspressBundleOptions} for options.
 * @public
 */
```

## `tsdoc-*` (parser warnings)

**Severity:** warning.

**Cause:** malformed TSDoc syntax. Common IDs:

- A literal `@` in prose parsed as a tag — the most common case here. A scoped package name written bare in doc text (`@savvy-web/bundler`) makes the parser read `@savvy-web` as an unknown tag. Fix: wrap it in a backtick code span (`` `@savvy-web/bundler` ``) or escape the at-sign as `\@savvy-web/bundler`.
- `tsdoc-undefined-tag` — a tag not in the supported set (e.g. a JSDoc-ism like `@memberof` or `@augments`, or a project tag you have not registered). Fix the tag, or register it (`custom-tags.md`).
- `tsdoc-param-tag-missing-hyphen` — `@param name description` must be `@param name - description`.
- `tsdoc-unnecessary-backslash` / `tsdoc-escape-*` — stray escapes.
- `tsdoc-inline-tag-missing-braces` / `tsdoc-malformed-inline-tag` — inline tags like `{@link X}` must be brace-wrapped and well-formed.

```ts
// before: JSDoc habits → tsdoc-param-tag-missing-hyphen + tsdoc-undefined-tag
/**
 * @param count the number of retries
 * @returns {number} the next delay
 */

// after: TSDoc — hyphen after the param name, no brace type on @returns
/**
 * @param count - the number of retries
 * @returns the next delay
 */
```
