---
id: packages/silk/export-map
title: silk subpath export map
summary: Load when wiring a config file to a @savvy-web/silk subpath, or auditing the export map.
tier: packages
source: hand
tags: [silk]
priority: 0.5
related: [packages/silk/install-and-setup]
---

## What

`@savvy-web/silk` has no root barrel. It exposes a set of nested config-integration
entry points, each loaded by a different external tool. The nested subpaths mirror
exactly the module shapes those tools load, rather than implying a coherent library
API.

## API

```text
./changesets              ← changeset class/services API surface
./changesets/changelog    ← ChangelogFunctions default for .changeset/config.json
./changesets/markdownlint ← markdownlint-cli2 rules (default array + named)
./changesets/remark       ← remark transform plugins + presets + lint rules
./commitlint              ← CommitlintConfig (auto-detecting factory) + types
./commitlint/static       ← static config default (no auto-detection)
./commitlint/prompt       ← commitizen adapter
./commitlint/formatter    ← custom error formatter
./lint                    ← handlers / Preset / createConfig / utils / section data
./biome                   ← static silk.jsonc asset (copied, not a shim)
```

The shim contract per subpath:

- `./changesets/changelog` — default export is the `@changesets/types`
  `ChangelogFunctions` object the Changesets CLI loads from the config's
  `changelog` field.
- `./changesets/markdownlint` — default export is the rule array markdownlint-cli2
  loads, plus the named rule objects.
- `./changesets/remark` — named exports for every transform plugin, preset, and
  lint rule remark configs import.
- `./commitlint/static` — default export is the static config object (no
  auto-detection); the root `./commitlint` default-exports the auto-detecting
  `CommitlintConfig` factory.
- `./lint` — the full lint-staged consumer surface (handlers, `Preset`,
  `createConfig`, workspace utils, section/template data). CLI commands are
  deliberately NOT re-exported here — those belong to the `savvy` CLI.

## Layer

The `exports` field in silk's `package.json` is the authoritative wiring; the shim
files under `src/` are the single source of truth for the exact reshaping. The
`./biome` entry is a copied asset, not a shim.

## Usage

A markdownlint config loading the Silk rules:

```text
extends: "@savvy-web/silk/biome"            # biome.jsonc
@savvy-web/silk/changesets/markdownlint     # markdownlint-cli2 customRules
```

## Related

Install and setup: `silk://packages/silk/install-and-setup`.
