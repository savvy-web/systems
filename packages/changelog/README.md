# @savvy-web/changelog

[![npm](https://img.shields.io/npm/v/@savvy-web%2Fchangelog?label=npm&color=cb3837)](https://www.npmjs.com/package/@savvy-web/changelog)
[![License: MIT](https://img.shields.io/badge/License-MIT-4caf50.svg)](https://opensource.org/licenses/MIT)

The [changesets](https://github.com/changesets/changesets) changelog generator for the [Silk Suite](https://github.com/savvy-web/systems) — the standalone, installable identity for `@savvy-web/silk-effects`' `Changesets.changelogFunctions`. Ships as dual ESM/CJS so the vanilla changesets CLI can `require()` it directly.

## Install

```bash
npm install --save-dev @savvy-web/changelog
# or
pnpm add -D @savvy-web/changelog
```

Projects that install [`@savvy-web/silk`](https://www.npmjs.com/package/@savvy-web/silk) already get it: silk ships it as a peer companion pinned to the matching suite version.

## Quick start

Reference it as the `changelog` entry in `.changeset/config.json`:

```json
{
  "changelog": ["@savvy-web/changelog", { "repo": "owner/repo" }]
}
```

`savvy init` from [`@savvy-web/cli`](https://www.npmjs.com/package/@savvy-web/cli) writes this entry automatically, filling in the detected repo slug.

## License

[MIT](LICENSE)
