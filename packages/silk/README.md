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

Installing `silk` pulls [`@savvy-web/cli`](https://www.npmjs.com/package/@savvy-web/cli) and [`@savvy-web/mcp`](https://www.npmjs.com/package/@savvy-web/mcp) along with the real tools its configs reference (Biome, husky, commitlint, changesets, lint-staged, markdownlint), so the versions stay in lockstep.

## Quick start

After install, seed the config files and wire the git hooks:

```bash
npx savvy init
# writes the changeset, commit and lint configs and wires husky to the savvy subcommands
```

The configs `savvy init` writes reference the `@savvy-web/silk` subpaths shown below. You can also write them by hand.

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

Changesets (`.changeset/config.json`) loads the changelog formatter:

```json
{
  "changelog": "@savvy-web/silk/changesets/changelog"
}
```

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
| `./changesets/changelog` | `ChangelogFunctions` default for `.changeset/config.json` |
| `./changesets/markdownlint` | markdownlint-cli2 rules (default array plus named rules) |
| `./changesets/remark` | remark transform plugins, presets and lint rules |
| `./commitlint` | Auto-detecting `CommitlintConfig` plus types |
| `./commitlint/static` | Static config default with no auto-detection |
| `./commitlint/prompt` | commitizen adapter |
| `./commitlint/formatter` | Custom commitlint error formatter |
| `./lint` | lint-staged handlers, `Preset`, `createConfig` and workspace utils |
| `./biome` | Static Biome preset asset |

The package ships dual-format ESM and CommonJS, because some loaders — markdownlint-cli2's custom-rule loader among them — `require()` these subpaths from a CommonJS context.

## License

[MIT](LICENSE)
