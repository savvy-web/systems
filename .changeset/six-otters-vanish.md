---
"@savvy-web/silk": minor
---

## Build System

Every subpath is now ESM-only. The Changesets CLI (v3), markdownlint-cli2 and commitlint all load their config modules with `import()`, so the dual-format CommonJS build of `./changesets/markdownlint` and the force-bundled copy of `@savvy-web/silk-effects` it carried are gone — the package is smaller and silk-effects is resolved as an ordinary external import.

## Maintenance

Deletes the dead subpaths that were deprecated when `@savvy-web/changelog` was split out and have had no consumers since:

* `./changesets` and `./changesets/changelog` — the changelog generator lives in `@savvy-web/changelog`, already the canonical `.changeset/config.json` changelog id
* `./changesets/remark`
* `./commitlint/static`, `./commitlint/prompt` and `./commitlint/formatter` — `./commitlint` is the surviving entry
