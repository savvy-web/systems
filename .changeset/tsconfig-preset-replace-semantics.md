---
"@savvy-web/bundler": patch
"@savvy-web/rspress-builder": patch
"@savvy-web/github-action-builder": patch
---

## Other

The shipped tsconfig presets now carry an inline note about how TypeScript resolves extends. The types and lib compiler options replace the base list rather than merging with it, so overriding either one in a consumer tsconfig means re-listing every entry still needed, node included, or losing access to console, process and Buffer with no warning from the compiler.

ecma.json in bundler and rspress-builder, plugin.json in rspress-builder, and action.json in github-action-builder each carry a top-level note key documenting this. The bundler README also gains a short section explaining the behavior and pointing at plugin.json as the working example, since it already re-lists node alongside react and react-dom.
