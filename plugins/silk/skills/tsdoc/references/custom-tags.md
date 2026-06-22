# Custom tags and warning suppression

Register project tags and suppress legitimate warnings through `meta.tsdoc` in a package's `savvy.build.ts`. Both flow into the generated `tsdoc.json` and into API Extractor's TSDoc config, so a registered tag no longer raises `tsdoc-undefined-tag`.

## Registering a custom tag

`meta.tsdoc.tagDefinitions` takes entries of:

```ts
{
  tagName: string;                              // e.g. "@since"
  syntaxKind: "block" | "inline" | "modifier";  // how it parses
  allowMultiple?: boolean;                       // may appear more than once
}
```

- **block** — owns the text that follows it on subsequent lines (like `@remarks`).
- **inline** — used inline, brace-wrapped (like `{@link}`).
- **modifier** — a standalone flag with no content (like `@public`).

### Real examples in this repo

A block tag (`@savvy-web/silk-effects`):

```ts
const config = defineBuild({
  meta: {
    tsdoc: {
      tagDefinitions: [{ tagName: "@since", syntaxKind: "block" }],
    },
  },
});
```

Modifier tags (`@savvy-web/github-action-builder`):

```ts
const config = defineBuild({
  meta: {
    tsdoc: {
      tagDefinitions: [
        { tagName: "@schema", syntaxKind: "modifier" },
        { tagName: "@layer", syntaxKind: "modifier" },
        { tagName: "@service", syntaxKind: "modifier" },
        { tagName: "@error", syntaxKind: "modifier" },
      ],
    },
  },
});
```

## Suppressing a warning (escape hatch — last resort)

Use `meta.tsdoc.suppressWarnings` only when a warning is a genuine false positive. Each rule exact-matches `messageId` and, with `pattern`, AND-matches a substring/regex against the message text:

```ts
{
  messageId: string;   // e.g. "ae-forgotten-export"
  pattern?: string;     // narrows to messages whose text contains/matches this
}
```

Real example (`@savvy-web/silk-effects`) — suppress a known forgotten-export on a base type:

```ts
suppressWarnings: [{ messageId: "ae-forgotten-export", pattern: "_base" }],
```

Prefer fixing the cause (`diagnostics.md`). Suppress only with a `pattern` narrow enough not to mask new, unrelated occurrences.
