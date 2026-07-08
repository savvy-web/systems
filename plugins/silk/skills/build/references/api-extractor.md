# API Extractor meta pass

This covers the **config** knobs (the `meta` option) and how to choose between the five bundling options. For writing the TSDoc comments themselves and fixing `ae-*`/`tsdoc-*` diagnostics, use `/silk:tsdoc`.

## `MetaOptions`

`meta` accepts `MetaOptions | false`.

| Field | Type | What it does |
| --- | --- | --- |
| `localPaths` | `string[]` | Directories to copy the generated api-model into, e.g. a docs site's models directory. |
| `optimistic` | `"auto" \| boolean` | Forward-look versions from pending changesets; `"auto"` keys off the CI environment. |
| `tsdoc` | `TsdocOptions` | TSDoc warning suppression + custom tag registration — see below. |

`meta: false` opts the package out of the meta pass entirely.

## `TsdocOptions`

`tsdoc.suppressWarnings` — `WarningSuppressionRule[]`, each `{ messageId, pattern }`: `messageId` is exact-matched (e.g. `ae-forgotten-export`), `pattern` (regex or substring) is AND-matched against the diagnostic text.

`tsdoc.tagDefinitions` — `TsdocTagDefinition[]`, each `{ tagName, syntaxKind, allowMultiple }`, where `syntaxKind` is `"block" | "inline" | "modifier"`.

```ts
await build({
  meta: {
    localPaths: ["../../website/lib/models/my-pkg"],
    tsdoc: {
      suppressWarnings: [{ messageId: "ae-forgotten-export", pattern: "InternalHelper" }],
      tagDefinitions: [{ tagName: "@category", syntaxKind: "block", allowMultiple: false }]
    }
  }
});
```

Reach for `suppressWarnings` only for genuine false positives; prefer fixing the export or release tag (see `/silk:tsdoc`).

## Bundling-knob decision guide

| Option | JS bundled? | Declarations inlined? | Reach for it when |
| --- | --- | --- | --- |
| `externals` | no | no | A dep must stay a runtime `import` in both JS and types (peer deps, large runtime deps). |
| `bundle` | yes | no | You want the JS inlined but the types can stay referenced. |
| `bundledPackages` | (tracks JS) | yes | An external dep's **types** must appear in your `.d.ts` (small type-only helpers). |
| `dtsExternals` | yes | no (kept as `import` in `.d.ts`) | JS should inline the dep but its **types** can't be safely inlined (e.g. `effect`'s `declare module`). |
| `bundleNodeModules` | yes (all) | tracks JS | You want a fully self-contained artifact with everything inlined. |

`externals` alone keeps a dependency external in BOTH the JS output and the `.d.ts`; adding it to `dtsExternals` changes nothing. Reach for `dtsExternals` only when you want the dependency JS-bundled but still need an `import` in the emitted `.d.ts` — the case where its types can't be safely inlined (e.g. `effect`'s `declare module`).
