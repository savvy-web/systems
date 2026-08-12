---
"@savvy-web/silk-effects": minor
"@savvy-web/silk": minor
---

## Features

### The YAML handler runs on `@effected/yaml` instead of Prettier and yaml-lint

`Lint.Yaml` now formats and validates through `@effected/yaml`. Prettier and `yaml-lint` leave the dependency tree entirely. `Yaml.create()` with default options needs no change.

What improves:

- Comments and blank lines survive formatting. The Prettier path dropped them in several positions.
- Every document of a multi-document stream is formatted, with `---` separators re-emitted, rather than the stream being truncated to its first document.
- Validation covers the whole stream. A file whose second document is invalid is now rejected; the old path could not see past the first.
- Formatting is idempotent — running it twice produces the same bytes as running it once.
- The formatter no longer invents line wraps. A long `key: value` pair that Prettier split across two lines at `printWidth` is left on one.

### Formatting options are configured in code

`YamlOptions` gains a `format` field taking `YamlFormattingOptions`:

```typescript
import { YamlFormattingOptions } from "@effected/yaml";

Yaml.create({
  format: YamlFormattingOptions.make({ indentSequences: false }),
});
```

The default is `quoteStyle: "double"` with `indentSequences: true`, matching the block-sequence indentation an ex-Prettier repository already has on disk. `quoteStyle` governs only scalars the stringifier creates — it never re-quotes scalars already present in a file.

## Refactoring

### `formatFile` and `validateFile` are synchronous

The YAML engine is a pure, IO-free tier, so the `Promise` these returned was never doing anything asynchronous. Both are plain synchronous calls now, and the handler from `Yaml.create()` throws on invalid YAML rather than returning a rejected promise. Awaiting them still works; a caller using `.catch()` should switch to `try`/`catch`.

```typescript
// Before
await Yaml.formatFile(filepath);
await Yaml.validateFile(filepath, schema);

// After
Yaml.formatFile(filepath);
Yaml.validateFile(filepath);
```

### The `.yaml-lint.json` config tier is removed

`Yaml.findConfig`, `Yaml.loadConfig`, `YamlOptions.config` and `validateFile`'s `schema` argument are gone. They read a `.yaml-lint.json` file that this toolchain never shipped or documented a location for, so the discovery always resolved to nothing and the schema was always undefined. `@effected/yaml` is a pure tier that loads nothing from disk; use the `format` option above instead.

`formatFile` also used to resolve the calling repository's Prettier config before formatting. Nothing reads `.prettierrc` now. `printWidth` was the only option with visible effect, and dropping it is the "no invented wraps" improvement listed above.
