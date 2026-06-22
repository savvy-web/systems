# Documentation depth for public API

Public exports in this monorepo are rendered into cross-linked API reference sites by `rspress-plugin-api-extractor` (the same API Extractor model that drives the build). Every public symbol becomes a page; every property becomes its own documented row. Sparse or missing TSDoc renders as blank rows, so completeness is the difference between a useful reference and an empty skeleton. Aim higher than "no warnings" — aim for docs a stranger could build against.

## Cover the whole public surface

When a symbol is `@public` (see `release-tags.md`), document it fully:

- **Every exported value and type** gets a TSDoc block — functions, classes, interfaces, type aliases, enums, and constants.
- **Every member of an exported type** gets its own description — each interface property, each method, each enum member, each function parameter. These render individually; an undocumented property is a blank row in the generated docs.
- Document the *purpose and meaning*, not the type. The type is already shown. Say what the value is for, what a non-obvious default implies, what invariant a property upholds.

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
