---
"@savvy-web/silk": major
---

## Breaking Changes

Ships `@changesets/cli@^3.0.0-next.8` to consumers (was `^2.31.0`) as both a `devDependency` and `peerDependency`. The v3 CLI is a significant contract change for anyone consuming this package:

- **ESM-only.** The CLI no longer ships a CommonJS build — projects invoking it programmatically must be able to `import` it.
- **Node >=22.11 required.** Consumers on older Node LTS lines will need to upgrade before adopting this version.
- **`changeset tag` is renamed `changeset git-tag`.** Any script or CI step invoking `changeset tag` must be updated to the new subcommand name.

## Maintenance

- The force-bundled CJS entries (`./changesets/changelog`, `./changesets/markdownlint`) now steer `jsonc-parser` — pulled in transitively by the v3 engine — to its ESM build at bundle time. Its UMD `main` entry survives rolldown's single-file CJS output with unresolvable relative `require("./impl/*")` calls, which made both entries throw `Cannot find module` at load.

## Dependencies

| Dependency      | Type           | Action  | From    | To            |
| --------------- | -------------- | ------- | ------- | ------------- |
| @changesets/cli | peerDependency | updated | ^2.31.0 | ^3.0.0-next.8 |
