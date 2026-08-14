---
"@savvy-web/github-action-builder": patch
---

## Bug Fixes

The `nativeDynamicImports` loader no longer rewrites `import(` occurrences inside comments, string literals, or template-literal text. Previously a doc comment merely mentioning `import(...)` had the `webpackIgnore` block comment injected into it, and the injected `*/` closed the enclosing comment early — corrupting the module with a syntax error reported against an unrelated line.

* Both loader passes are now gated by a lexical scan that protects line comments, block comments, string literals, template-literal text, and regex literals
* An empty-argument `import()` — the prose form doc comments use — is also excluded, since it is never a resolvable dynamic import
* Real dynamic imports, including inside `${ ... }` template interpolations, are still rewritten
