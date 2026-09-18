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

Changesets (`.changeset/config.json`) loads the changelog generator, the standalone [`@savvy-web/changelog`](https://www.npmjs.com/package/@savvy-web/changelog) package that silk ships as an exact-pinned dependency:

```json
{
  "changelog": ["@savvy-web/changelog", { "repo": "owner/repo" }]
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
| `./changesets/markdownlint` | markdownlint-cli2 rules (default array plus named rules) |
| `./commitlint` | Auto-detecting `CommitlintConfig` plus types |
| `./lint` | lint-staged handlers, `Preset`, `createConfig` and workspace utils |
| `./biome` | Static Biome preset asset |

Every subpath ships as ESM only. The Changesets CLI (v3), markdownlint-cli2 and commitlint all load their config modules with `import()`, so no CommonJS build is needed.

## License

[MIT](LICENSE)
