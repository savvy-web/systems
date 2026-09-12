# @savvy-web/silk-core

[![npm](https://img.shields.io/npm/v/@savvy-web%2Fsilk-core?label=npm&color=cb3837)](https://www.npmjs.com/package/@savvy-web/silk-core)
[![License: MIT](https://img.shields.io/badge/License-MIT-4caf50.svg)](https://opensource.org/licenses/MIT)

The platform-free domain core of the Silk Suite: the [Effect](https://effect.website/) schemas, tagged errors and the PR-body contract that every other Silk package builds on. Nothing in this package touches a filesystem, a subprocess, a clock or `process` — it is pure data modelling, safe to import from any runtime.

## Features

- Workspace-analysis schemas — `AnalyzedWorkspace`, `WorkspaceAnalysis` and the Silk-extended `SilkPublishConfig` with its multi-registry `targets`
- Changeset config file schemas (`ChangesetConfigFile`, `SilkChangesetConfigFile`) and the config-discovery result types
- The managed `savvy-*` shell sections (`SavvyBaseSection`, `SavvyHooksSection`, `SavvyInstallSection`, `SavvyToolchainSection`) and their block builders
- The frozen `PrBody` contract — `silk-release` markers, managed regions, closing-reference spellings and diagnostics — shared by every PR-body writer
- Typed errors (`BiomeSyncError`, `ChangesetConfigError`, `ConfigNotFoundError`, `PublishTargetBindingError`, `WorkspaceAnalysisError`)

## Install

```bash
pnpm add @savvy-web/silk-core effect @effected/workspaces
```

`effect` and `@effected/workspaces` are peer dependencies.

## Usage

```ts
import { PrBody, SilkPublishConfig } from "@savvy-web/silk-core";
import { Schema } from "effect";

const config = Schema.decodeUnknownSync(SilkPublishConfig)({
 access: "public",
 targets: ["npm", "github"],
});

const body = PrBody.ManagedPrBody.build({
 subject: "feat(silk-core): extract domain core",
 linkedIssues: [PrBody.LinkedIssueRef.make({ number: 419, title: "Share the PR-body contract", state: "open" })],
 signoff: "Signed-off-by: C. Spencer Beggs <spencer@savvyweb.systems>",
 summary: "Extract the domain core.",
});
```

Most consumers reach these symbols through `@savvy-web/silk-effects`, which re-exports the whole surface under the same names alongside the platform-backed services. Depend on `@savvy-web/silk-core` directly when you only need the data model.

## License

MIT
