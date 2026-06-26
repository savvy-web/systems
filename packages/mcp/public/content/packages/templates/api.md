---
id: packages/templates/api
title: "@savvy-web/templates — API reference"
summary: "@savvy-web/templates API reference: 36 documented symbols."
tier: packages
source: generated
tags: [templates, api]
priority: 0.4
related: []
---

# @savvy-web/templates — API reference

## function

- [`createBiome`](silk://packages/templates/api/function/createbiome) — Generates a `biome.jsonc` configuration file entry.
- [`createChangeset`](silk://packages/templates/api/function/createchangeset) — Generates a `.changeset/config.json` configuration file entry.
- [`createGitignore`](silk://packages/templates/api/function/creategitignore) — Generates a `.gitignore` file entry.
- [`createPackageJson`](silk://packages/templates/api/function/createpackagejson) — Generates a sorted `package.json` file entry.
- [`createPnpmWorkspace`](silk://packages/templates/api/function/createpnpmworkspace) — Generates a `pnpm-workspace.yaml` file entry.
- [`createReadme`](silk://packages/templates/api/function/createreadme) — Generates a `README.md` file entry.
- [`createTsConfig`](silk://packages/templates/api/function/createtsconfig) — Generates a `tsconfig.json` file entry.
- [`createTurboRoot`](silk://packages/templates/api/function/createturboroot) — Generates a root `turbo.json` file entry.
- [`createTurboWorkspace`](silk://packages/templates/api/function/createturboworkspace) — Generates a workspace-level `turbo.json` file entry.
- [`createVsCode`](silk://packages/templates/api/function/createvscode) — Generates `.vscode/settings.json` and `.vscode/extensions.json` file entries.
- [`createWorkspace`](silk://packages/templates/api/function/createworkspace) — Generates all file entries for a new workspace scaffold.

## interface

- [`TemplateEntry`](silk://packages/templates/api/interface/templateentry) — A generated content entry from a template. Templates produce content with a logical name and suggested filename. The consumer decides where (and whether) to write the content.

## type

- [`BiomeOptionsType`](silk://packages/templates/api/type/biomeoptionstype) — The decoded type of BiomeOptions.
- [`ChangesetOptionsType`](silk://packages/templates/api/type/changesetoptionstype) — The decoded type of ChangesetOptions.
- [`GitignoreOptionsType`](silk://packages/templates/api/type/gitignoreoptionstype) — The decoded type of GitignoreOptions.
- [`PackageJsonOptionsType`](silk://packages/templates/api/type/packagejsonoptionstype) — The decoded type of PackageJsonOptions.
- [`PnpmWorkspaceOptionsType`](silk://packages/templates/api/type/pnpmworkspaceoptionstype) — The decoded type of PnpmWorkspaceOptions.
- [`ReadmeOptionsType`](silk://packages/templates/api/type/readmeoptionstype) — The decoded type of ReadmeOptions.
- [`Template`](silk://packages/templates/api/type/template) — A template: typed options in, content entries out.
- [`TsConfigOptionsType`](silk://packages/templates/api/type/tsconfigoptionstype) — The decoded type of TsConfigOptions.
- [`TurboRootOptionsType`](silk://packages/templates/api/type/turborootoptionstype) — The decoded type of TurboRootOptions.
- [`TurboWorkspaceOptionsType`](silk://packages/templates/api/type/turboworkspaceoptionstype) — The decoded type of TurboWorkspaceOptions.
- [`UpdateTemplate`](silk://packages/templates/api/type/updatetemplate) — An update template: existing content + partial options in, content entries out.
- [`VsCodeOptionsType`](silk://packages/templates/api/type/vscodeoptionstype) — The decoded type of VsCodeOptions.
- [`WorkspaceOptionsType`](silk://packages/templates/api/type/workspaceoptionstype) — The decoded type of WorkspaceOptions.

## variable

- [`BiomeOptions`](silk://packages/templates/api/variable/biomeoptions) — Options for generating a Biome configuration file.
- [`ChangesetOptions`](silk://packages/templates/api/variable/changesetoptions) — Options for generating a Changesets configuration file.
- [`GitignoreOptions`](silk://packages/templates/api/variable/gitignoreoptions) — Options for generating a `.gitignore` file.
- [`PackageJsonOptions`](silk://packages/templates/api/variable/packagejsonoptions) — Options for generating a `package.json` file.
- [`PnpmWorkspaceOptions`](silk://packages/templates/api/variable/pnpmworkspaceoptions) — Options for generating a `pnpm-workspace.yaml` file.
- [`ReadmeOptions`](silk://packages/templates/api/variable/readmeoptions) — Options for generating a `README.md` file.
- [`TsConfigOptions`](silk://packages/templates/api/variable/tsconfigoptions) — Options for generating a `tsconfig.json` file.
- [`TurboRootOptions`](silk://packages/templates/api/variable/turborootoptions) — Options for generating a root `turbo.json` file.
- [`TurboWorkspaceOptions`](silk://packages/templates/api/variable/turboworkspaceoptions) — Options for generating a workspace-level `turbo.json` file.
- [`VsCodeOptions`](silk://packages/templates/api/variable/vscodeoptions) — Options for generating VS Code configuration files.
- [`WorkspaceOptions`](silk://packages/templates/api/variable/workspaceoptions) — Options for generating a complete workspace scaffold.
