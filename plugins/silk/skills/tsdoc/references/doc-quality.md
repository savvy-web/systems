# Documentation depth for public API

Public exports in this monorepo are rendered into cross-linked API reference sites by `rspress-plugin-api-extractor` (the same API Extractor model that drives the build). Every public symbol becomes a page; every property becomes its own documented row. Sparse or missing TSDoc renders as blank rows, so completeness is the difference between a useful reference and an empty skeleton. Aim higher than "no warnings" — aim for docs a stranger could build against.

## Cover the whole public surface

A release tag is not documentation. **Every exported declaration that carries `@public` or `@internal` needs a one-line summary describing its purpose** — adding the tag to clear `ae-missing-release-tag` but leaving the block otherwise empty is only half the fix. `@public` symbols render as blank reference rows; `@internal` symbols read as undocumented to the maintainers and agents who work on them. Describe both.

When a symbol is `@public` (see `release-tags.md`), document it fully:

- **Every exported value and type** gets a TSDoc block — functions, classes, interfaces, type aliases, enums, and constants.
- **Every member of an exported type** gets its own description — each interface property, each method, each enum member, each function parameter. These render individually; an undocumented property is a blank row in the generated docs.
- Document the *purpose and meaning*, not the type. The type is already shown. Say what the value is for, what a non-obvious default implies, what invariant a property upholds.

## Export from the source, not through barrels

Re-exporting values and types through barrel files (`export { X } from "./x.js"`, `export * from "./x.js"`) is almost always a footgun. It detaches a symbol from its declaration, so the API model has to chase the re-export to find the doc comment and release tag — which makes doc generation harder and is a frequent source of `ae-*` diagnostics. Prefer source that imports and exports each value and type **explicitly from the module that declares it**.

Fixing this is a source refactor, not a TSDoc edit, so it is outside the mechanical diagnostic-clearing loop. When a barrel re-export is the root of a diagnostic, **flag it and ask the user before refactoring** rather than reshaping the export structure unilaterally. In the meantime, put the release tag and summary on the original declaration, never on the `export { ... }` line.

## Description, `@remarks`, `@privateRemarks`

- **Summary (required).** Every public type and member opens with a one-line summary of its purpose — the first paragraph of the TSDoc block. This is the text shown inline in the rendered reference.
- **`@remarks` (when it needs depth).** Move extended explanation — edge cases, interactions, when-to-use guidance — into `@remarks` so the summary stays scannable. The summary is the headline; `@remarks` is the body.
- **`@privateRemarks` (internal notes).** Use `@privateRemarks` for notes aimed at maintainers and agents, not users — why something is shaped oddly, a known wrinkle, context worth preserving for whoever next touches it. It is stripped from the published/rendered docs, so it is the right home for internal context that would only confuse a consumer.

```ts
/**
 * Resolved configuration the plugin hands to the reporter factory.
 *
 * @remarks
 * `dbPath` is optional at the type level so stdout-only renderers can ignore the
 * persistence layer; the plugin always populates it in practice.
 *
 * @privateRemarks
 * Kept structurally identical to ReporterKit's input so the factory needs no adapter.
 * If you add a field here, mirror it in MapSessionInput or the factory drops it silently.
 *
 * @public
 */
export interface ResolvedReporterConfig {
 /** Console rendering mode selected for the active executor. */
 readonly consoleMode: ConsoleMode;
 /** Absolute path to the persistence database; omitted by stdout-only renderers. */
 readonly dbPath?: string;
}
```

## `@example` blocks must be complete, compilable programs

`rspress-plugin-api-extractor` renders `@example` code through Twoslash, which **type-checks each block**. A block that references an unimported value or type fails to render. Rules:

- **Import everything the block uses.** A reader must be able to copy the example and run it. No free variables, no "assume `x` exists".
- **Import values and types separately.** Use `import type { ... }` for types and a normal `import { ... }` for values — never mix them in one statement.
- **Make the example earn its place.** Show a real, useful interaction — the common task a consumer actually performs. Importing a value and logging it is not useful. You *may* show values when it clarifies behavior.
- **Show output in a comment.** When you log or compute a result, put the result in a trailing comment (`// => ...`) so the reader sees the outcome without running it.

```ts
import { definePlugin } from "@savvy-web/rspress-builder";
import type { RspressPluginOptions } from "@savvy-web/rspress-builder";

// A plugin with no browser runtime: build only the node (`.`) partition.
const options: RspressPluginOptions = { runtime: false };
const config = definePlugin(options);

console.log(config.partitions);
// => ["."]
```

Counter-example — do **not** write this:

```ts
// Bad: nothing imported (Twoslash fails), and logging a bare value teaches nothing.
const config = definePlugin();
console.log(config);
```
