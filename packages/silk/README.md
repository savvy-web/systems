# @savvy-web/silk

[![npm](https://img.shields.io/npm/v/@savvy-web%2Fsilk?label=npm&color=cb3837)](https://www.npmjs.com/package/@savvy-web/silk)
[![License: MIT](https://img.shields.io/badge/License-MIT-4caf50.svg)](https://opensource.org/licenses/MIT)

The single package you install to get the whole [Silk Suite](https://github.com/savvy-web/systems) dev-tooling system: drop-in config entry points for changesets, commitlint and lint-staged, a Biome preset and — through its peers — the `savvy` CLI. Each subpath re-exports the matching logic from `@savvy-web/silk-effects` in the exact module shape the consuming tool's config loader expects.

## Install

```bash
npm install --save-dev @savvy-web/silk
# or
pnpm add -D @savvy-web/silk
```

Installing `silk` pulls [`@savvy-web/cli`](https://www.npmjs.com/package/@savvy-web/cli), [`@savvy-web/mcp`](https://www.npmjs.com/package/@savvy-web/mcp) and [`@savvy-web/changelog`](https://www.npmjs.com/package/@savvy-web/changelog) along with the real tools its configs reference (Biome, husky, commitlint, changesets, lint-staged, markdownlint), so the versions stay in lockstep.

## Quick start

After install, seed the config files and wire the git hooks:

```bash
npx savvy init
# writes the changeset, commit and lint configs and wires husky to the savvy subcommands
```

The configs `savvy init` writes reference the entry points shown below. You can also write them by hand.

## Config entry points

Point each tool's config at the matching subpath.

Commitlint (`commitlint.config.ts`) re-exports the auto-detecting config:

```ts
export { default } from "@savvy-web/silk/commitlint";
```

Markdownlint (`.markdownlint-cli2.jsonc`) loads the changeset rule module:

```jsonc
{
  "customRules": ["@savvy-web/silk/changesets/markdownlint"]
}
```

Changesets (`.changeset/config.json`) loads the changelog generator, the standalone [`@savvy-web/changelog`](https://www.npmjs.com/package/@savvy-web/changelog) package that silk ships as a peer:

```json
{
  "changelog": ["@savvy-web/changelog", { "repo": "owner/repo" }]
}
```

The `@savvy-web/silk/changesets/changelog` subpath re-exports the same generator and remains accepted by `savvy check`.

Biome (`biome.jsonc`) extends the bundled preset:

```jsonc
{
  "extends": ["@savvy-web/silk/biome"]
}
```

## Export map

| Subpath | What it provides |
| ------- | ---------------- |
| `./changesets` | Changeset class and service surface |
| `./changesets/changelog` | `ChangelogFunctions` default (same generator as `@savvy-web/changelog`) |
| `./changesets/markdownlint` | markdownlint-cli2 rules (default array plus named rules) |
| `./changesets/remark` | remark transform plugins, presets and lint rules |
| `./commitlint` | Auto-detecting `CommitlintConfig` plus types |
| `./commitlint/static` | Static config default with no auto-detection |
| `./commitlint/prompt` | commitizen adapter |
| `./commitlint/formatter` | Custom commitlint error formatter |
| `./lint` | lint-staged handlers, `Preset`, `createConfig` and workspace utils |
| `./biome` | Static Biome preset asset |

Most subpaths ship as ESM. The `./changesets/markdownlint` entry additionally ships a CommonJS build, because markdownlint-cli2's custom-rule loader `require()`s it from a CommonJS context.

## License

[MIT](LICENSE)
