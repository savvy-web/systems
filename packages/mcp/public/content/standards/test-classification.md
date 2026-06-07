---
id: standards/test-classification
title: Test classification
summary: Load when naming a test file or wondering why Vitest classifies it as unit, e2e, or int.
tier: standards
source: hand
tags: [test]
priority: 0.8
related: [standards/linting-conventions]
---

## Rule

`VitestConfig.create()` discovers workspace packages and classifies each test file
by its **filename**, not its directory. The first matching pattern wins:

- `*.e2e.(test|spec).(ts|tsx|js|jsx)` → e2e
- `*.int.(test|spec).(ts|tsx|js|jsx)` → integration
- `*.(test|spec).(ts|tsx|js|jsx)` → unit (catch-all; `*.unit.test.ts` lands here)

Files matching none are ignored. Tests live in `src/` and an optional `__test__/`
directory beside it; only packages with a `src/` directory are scanned.

## Why

Filename-driven classification keeps the directory layout free and the kind
unambiguous — `foo.e2e.test.ts` is never double-counted as a unit test because the
e2e pattern is checked first. A package with one test kind gets a bare project name
(`@scope/pkg`); two or more kinds get suffixed names (`@scope/pkg:unit`,
`@scope/pkg:e2e`). A package with `src/` but no tests still gets a unit project as
a forward-looking placeholder.

## Examples

`parser.test.ts` and `parser.unit.test.ts` → unit. `auth.e2e.test.ts` → e2e.
`db.int.test.ts` → integration.

Helper and fixture directories are excluded from discovery at conventional
locations only: `__test__/fixtures/`, `__test__/utils/`, and the same under
`__test__/{unit,e2e,integration}/`. A `vitest.setup.{ts,tsx,js,jsx}` at the
package root is auto-detected and added to `setupFiles`.

Coverage defaults to the `"strict"` level (lines 80, branches 75, functions 80,
statements 80). Passing `--project` flags scopes coverage to the union of the
matched packages.

## See also

Lint and format rules are at `silk://standards/linting-conventions`.
