---
"@savvy-web/silk": minor
---

## Features

### @savvy-web/changelog ships as a peer companion

`@savvy-web/silk` now declares `@savvy-web/changelog` as a peer dependency alongside `@savvy-web/cli` and `@savvy-web/mcp` — installing `@savvy-web/silk` brings in the standalone changesets changelog generator as part of the same peer group.

## Bug Fixes

- The `./changesets/changelog` and `./changesets/markdownlint` subpath artifacts are now genuinely self-contained ESM builds (via the `@savvy-web/tsdown-plugins` fix) — the previously-published ESM variants of these subpaths silently broke once packed with `npm pack`.

## Dependencies

| Dependency           | Type      | Action | From | To    |
| :------------------- | :-------- | :----- | :--- | :---- |
| @savvy-web/changelog | workspace | added  | —    | 0.1.0 |
