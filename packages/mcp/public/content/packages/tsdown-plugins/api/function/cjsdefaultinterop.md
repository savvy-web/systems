---
id: packages/tsdown-plugins/api/function/cjsdefaultinterop
title: "cjsDefaultInterop — tsdown-plugins function"
summary: "Rolldown plugin: append the CJS default-interop footer to ENTRY chunks of the `cjs` format that export a default alongside named exports. Gated tightly so it n…"
tier: packages
source: generated
tags: [tsdown-plugins, api]
priority: 0.3
related: []
---

# cjsDefaultInterop

Rolldown plugin: append the CJS default-interop footer to ENTRY chunks of the `cjs` format that export a default alongside named exports. Gated tightly so it never touches the wrong chunk: - format must be `cjs` (ESM is untouched; `import().default` on ESM is already correct); - the chunk must be an ENTRY chunk — never a SHARED chunk. Shared chunks are required by entry chunks via their named bindings (e.g. `require_changesets.changesets_exports.X`); reassigning a shared chunk's `module.exports` to its own default would break those reads (many bundled vendor chunks carry an `exports.default`); - the chunk must export a `default` AND at least one named export. A default-only chunk already gets `module.exports = <default>` from rolldown, and a named-only chunk has no default to promote. The emitted footer is also self-guarded (`module.exports.default !== void 0`), so it is a runtime no-op whenever the static gate is ever too generous.

```ts
function cjsDefaultInterop(): Plugin;
```
