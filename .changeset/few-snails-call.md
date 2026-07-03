---
"@savvy-web/pnpm-plugin-silk": minor
---

## Bug Fixes

Overrides `@manypkgs/get-root` to install modern `@types/node`. An ancient version was being dragging into the dependency graph because the package ships with devDependencies declared in it's package.json.