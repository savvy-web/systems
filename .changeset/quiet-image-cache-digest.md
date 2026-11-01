---
"@savvy-web/tsdown-plugins": patch
---

## Bug Fixes

The Open Graph image cache now provides a Node `Digest` implementation, which `@effected/images` 0.8 requires for cache keys. Generated image output is unchanged.

The API Extractor tsconfig keeps the base tsconfig's `compilerOptions.paths` working when the build supplies its own self-reference paths. Those base mappings are re-emitted into a derived config written to the temporary directory, and two things went wrong there:

- The base was read as plain JSON from its own file only, so a base with comments or trailing commas, or one inheriting `paths` from further up its `extends` chain, lost them.
- Relative targets were copied verbatim, so `./src/*` resolved under the temporary directory instead of the project.

The base is now resolved with the same tsc-parity loader the portable tsconfig uses, and every relative target is anchored to the effective `baseUrl`, or else to the directory of the config that declared `paths`.
