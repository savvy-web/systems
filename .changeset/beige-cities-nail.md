---
"@savvy-web/pnpm-plugin-silk": minor
---

## Breaking Changes

### The `test` catalog moves to Vitest 5

`catalog:test` and `catalog:test:peers` now resolve `vitest`, `@vitest/coverage-v8`, and `@vitest/coverage-istanbul` to `^5.0.0`. Every repository that references these aliases installs Vitest 5.0.0 on its next `pnpm install`, and every package that declares `vitest` as `catalog:test:peers` publishes a `^5.0.0` peer range. Vitest 5 is a major release with its own breaking changes; review the [Vitest 5 migration guide](https://vitest.dev/guide/migration.html) before upgrading a consuming repository.

The changes most likely to reach a Silk repository:

* `vite` is now a required peer of `vitest` rather than a dependency, so it must be installed explicitly. The `test` catalog now carries it (see Features).
* `@vitest/runner`, `@vitest/expect`, and `@vitest/utils` are inlined into `vitest` and no longer published as first-class packages. Import their types from `vitest` or `vitest/config` instead (for example `TestTagDefinition` from `vitest/config`).
* The `vitest/reporters`, `vitest/coverage`, `vitest/environments`, `vitest/snapshot`, `vitest/runners`, `vitest/suite`, and `vitest/mocker` entry points are removed.
* `clearMocks` defaults to `true`, unawaited async assertions fail the test, and `vi.mock` / `vi.hoisted` must sit at module top level.
* Reporter output moves under `.vitest/`: the `json` and `junit` reporters write files there by default instead of stdout, attachments land in `.vitest/attachments/`, and the `html` reporter option is `outputDir`. Add `.vitest` to `.gitignore`.
* `-t` / `--testNamePattern` joins suite and test names with `' > '` instead of a space.
* `coverage.include` and `coverage.exclude` match paths relative to the project root, and an `include` pattern without a wildcard is treated as a directory.
* `coverage.thresholds.autoUpdate` callbacks receive `(newThreshold, previousThreshold)`, and glob-scoped thresholds no longer inherit the top-level `perFile`.
* The default reporter in agent environments is `minimal` (`agent` remains an alias).

To stay on Vitest 4 temporarily, declare the previous ranges in the repository's own `pnpm-workspace.yaml` `catalogs:` block; a local entry overrides the managed one per package.

```yaml
catalogs:
  test:
    vitest: ^4.1.11
    "@vitest/coverage-v8": ^4.1.11
    "@vitest/coverage-istanbul": ^4.1.11
  test:peers:
    vitest: ^4.1.0
    "@vitest/coverage-v8": ^4.1.0
    "@vitest/coverage-istanbul": ^4.1.0
```

## Features

### `vite` joins the `test` catalog

Vitest 5 declares `vite` as a required peer dependency. The `test` catalog now supplies it (`^8.2.3`, peer `^8.2.0`) so a test-only repository can reference `catalog:test` for `vite` without borrowing the `docs` catalog's entry.

## Dependencies

| Dependency                 | Type   | Action  | From             | To               |
| :------------------------- | :----- | :------ | :--------------- | :--------------- |
| vitest                     | config | updated | ^4.1.11          | ^5.0.0           |
| @vitest/coverage-v8        | config | updated | ^4.1.11          | ^5.0.0           |
| @vitest/coverage-istanbul  | config | updated | ^4.1.11          | ^5.0.0           |
| vite                       | config | added   | —                | ^8.2.3           |
| @types/bun                 | config | updated | ^1.4.0           | ^1.4.1           |
| vitepress                  | config | updated | ^2.0.0-alpha.19  | ^2.0.0-alpha.20  |
| @changesets/cli            | config | updated | ^3.0.1           | ^3.0.2           |
| lint-staged                | config | updated | ^17.4.1          | ^17.5.0          |
