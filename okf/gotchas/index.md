# Gotcha

* [A public-hoisted workspace package resolves to its source tree, not its built artifact](hoisted-workspace-package-resolves-source.md) - Hoisting a workspace package via publicHoistPattern symlinks the package's source directory and ignores publishConfig.directory, so a tool that resolves it by id loads raw TypeScript through Node's type-stripping and looks like it works.
