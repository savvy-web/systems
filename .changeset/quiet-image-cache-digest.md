---
"@savvy-web/tsdown-plugins": patch
---

## Bug Fixes

The Open Graph image cache now provides a Node `Digest` implementation, which `@effected/images` 0.8 requires for cache keys. Generated image output is unchanged.

The API Extractor tsconfig now reads the base tsconfig as JSONC. A base with comments or trailing commas previously failed the plain JSON read, so its `compilerOptions.paths` were silently dropped from the derived config whenever the build supplied its own self-reference paths.
