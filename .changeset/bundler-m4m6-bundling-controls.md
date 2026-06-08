---
"@savvy-web/tsdown-plugins": minor
"@savvy-web/bundler": minor
---

## Features

### Dependency-bundling controls and CJS default interop

`defineBuild` gains three dependency-control options so a package can produce a self-contained, CJS-compatible build:

- `bundleNodeModules` force-bundles `node_modules` and workspace dependencies that are not externalized into the output, restoring the bundle-everything-except-externals behavior of the previous rslib builder.
- `dtsExternals` externalizes the listed packages in the declaration pass only — they are emitted as `import` references in the `.d.ts` while the JavaScript pass still bundles them. Use it when a dependency ships cross-module `declare module` augmentations that cannot be safely inlined into one declaration file.
- `bundledPackages` selectively inlines only the listed external packages' types into the bundled `.d.ts` and leaves every other dependency as an external reference.

Dual-format CJS entries now emit `module.exports = <default export>` with the named exports attached, so `import().default` and `require()` yield the default value directly — matching the previous rslib `cjsInterop` behavior and keeping consumers such as markdownlint-cli2 and commitlint working. Manifest export paths are derived from the shared entry-name function, with a build-time guard that fails the build when two export keys collapse to the same output name.
